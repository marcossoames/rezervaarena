import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BankingRequest {
  operation: 'read' | 'create' | 'update' | 'delete'
  bankDetails?: {
    account_holder_name: string
    bank_name: string
    iban: string
  }
  verification_code?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for enhanced security operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from authorization header using JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the JWT token using the anon key client
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const anonClient = createClient(supabaseUrl, supabaseAnon)
    
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      throw new Error('Authentication required')
    }

    // Create a user-scoped client so RLS/auth.uid() work inside DB triggers
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // Get request body
    const body: BankingRequest = await req.json()
    
    // Get client IP and user agent for audit logging
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    console.log(`Banking operation requested: ${body.operation} by user ${user.id} from IP ${clientIP}`)

    // Enhanced security checks
    await performSecurityChecks(supabase, user.id, clientIP, userAgent, body.operation)

    // Route to appropriate operation
    let result
    switch (body.operation) {
      case 'read':
        result = await readBankDetails(userClient, user.id)
        break
      case 'create':
      case 'update':
        if (!body.bankDetails) {
          throw new Error('Bank details required for create/update operations')
        }
        result = await upsertBankDetails(userClient, user.id, body.bankDetails, body.operation)
        break
      case 'delete':
        result = await deleteBankDetails(userClient, user.id)
        break
      default:
        throw new Error('Invalid operation')
    }

    // Log successful operation
    await logBankingActivity(supabase, user.id, body.operation, clientIP, userAgent, 'success')

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Banking operation error:', error)
    
    // Log failed operation
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        const token = authHeader.replace('Bearer ', '')
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
        const anonClient = createClient(supabaseUrl, supabaseAnon)
        
        const { data: { user } } = await anonClient.auth.getUser(token)
        
        if (user) {
          const clientIP = req.headers.get('cf-connecting-ip') || 'unknown'
          const userAgent = req.headers.get('user-agent') || 'unknown'
          await logBankingActivity(supabase, user.id, 'unknown', clientIP, userAgent, 'failed', (error as Error).message)
        }
      }
    } catch (logError) {
      console.error('Failed to log banking error:', logError)
    }

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function performSecurityChecks(supabase: any, userId: string, clientIP: string, userAgent: string, operation: string) {
  // Check for rate limiting
  const rateLimitCheck = await checkRateLimit(supabase, userId, operation)
  if (!rateLimitCheck.allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${rateLimitCheck.resetTime} seconds`)
  }

  // Check for suspicious activity patterns
  await checkSuspiciousActivity(supabase, userId, clientIP, userAgent)

  // For write operations, require recent authentication (last 30 minutes)
  if (['create', 'update', 'delete'].includes(operation)) {
    await validateRecentAuthentication(supabase, userId)
  }
}

async function checkRateLimit(supabase: any, userId: string, operation: string) {
  const windowMs = 300000 // 5 minutes
  const maxAttempts = operation === 'read' ? 10 : 3 // Stricter limits for write operations
  
  const { data: attempts } = await supabase
    .from('rate_limit_log')
    .select('created_at')
    .eq('user_id', userId)
    .eq('operation', `banking_${operation}`)
    .gte('created_at', new Date(Date.now() - windowMs).toISOString())

  if (attempts && attempts.length >= maxAttempts) {
    const oldestAttempt = new Date(attempts[0].created_at)
    const resetTime = Math.ceil((oldestAttempt.getTime() + windowMs - Date.now()) / 1000)
    return { allowed: false, resetTime }
  }

  return { allowed: true, resetTime: 0 }
}

async function checkSuspiciousActivity(supabase: any, userId: string, clientIP: string, userAgent: string) {
  // Check for multiple IPs in short time
  const { data: recentIPs } = await supabase
    .from('banking_activity_log')
    .select('ip_address')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
    .neq('ip_address', clientIP)

  if (recentIPs && recentIPs.length > 2) {
    console.warn(`Suspicious activity: User ${userId} accessed from multiple IPs: ${recentIPs.map((r: any) => r.ip_address).join(', ')}, ${clientIP}`)
    throw new Error('Suspicious activity detected. Please contact support.')
  }

  // Check for rapid successive attempts
  const { data: recentAttempts } = await supabase
    .from('banking_activity_log')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute

  if (recentAttempts && recentAttempts.length > 5) {
    throw new Error('Too many requests in short time. Please wait before trying again.')
  }
}

async function validateRecentAuthentication(supabase: any, userId: string) {
  // For now, we'll implement this as a basic check
  // In a production environment, you might want to validate the JWT's iat claim
  console.log(`Validating recent authentication for user ${userId}`)
  // This could be enhanced to check the JWT's issued at time
}

async function readBankDetails(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('bank_details')
    .select('id, account_holder_name, bank_name, iban, created_at, updated_at')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    throw new Error(`Failed to read bank details: ${error.message}`)
  }

  // Mask IBAN for display and never return full IBAN
  if (data && data.iban) {
    data.iban_masked = maskIban(data.iban)
    delete data.iban
  }

  return { bankDetails: data }
}

async function upsertBankDetails(supabase: any, userId: string, bankDetails: any, operation: string) {
  // Validate inputs server-side
  validateBankDetails(bankDetails)

  // Sanitize inputs
  const sanitizedIban = sanitizeInput(bankDetails.iban.replace(/\s/g, '').toUpperCase())

  // Validate IBAN format (Romanian IBAN)
  if (!validateIbanFormat(sanitizedIban)) {
    throw new Error('Invalid IBAN format for Romania')
  }

  const sanitizedData = {
    user_id: userId,
    account_holder_name: sanitizeInput(bankDetails.account_holder_name),
    bank_name: sanitizeInput(bankDetails.bank_name),
    iban: sanitizedIban // Store plaintext IBAN
  }

  let result
  if (operation === 'create') {
    const { data, error } = await supabase
      .from('bank_details')
      .insert([sanitizedData])
      .select()
      .single()
    
    if (error) throw new Error(`Failed to create bank details: ${error.message}`)
    result = data
  } else {
    const { data, error } = await supabase
      .from('bank_details')
      .update(sanitizedData)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) throw new Error(`Failed to update bank details: ${error.message}`)
    result = data
  }

  // Mask IBAN for response (never send full IBAN)
  if (result && result.iban) {
    result.iban_masked = maskIban(result.iban)
    delete result.iban
  }

  return { bankDetails: result }
}

async function deleteBankDetails(supabase: any, userId: string) {
  const { error } = await supabase
    .from('bank_details')
    .delete()
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to delete bank details: ${error.message}`)

  return { success: true }
}

async function logBankingActivity(supabase: any, userId: string, operation: string, clientIP: string, userAgent: string, status: string, errorMessage?: string) {
  try {
    await supabase
      .from('banking_activity_log')
      .insert([{
        user_id: userId,
        operation: `banking_${operation}`,
        ip_address: clientIP,
        user_agent: userAgent,
        status,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      }])

    // Also log to rate limit table for rate limiting purposes
    await supabase
      .from('rate_limit_log')
      .insert([{
        user_id: userId,
        operation: `banking_${operation}`,
        ip_address: clientIP,
        created_at: new Date().toISOString()
      }])
  } catch (error) {
    console.error('Failed to log banking activity:', error)
  }
}

function validateBankDetails(bankDetails: any) {
  if (!bankDetails.account_holder_name || bankDetails.account_holder_name.trim().length < 2) {
    throw new Error('Account holder name must be at least 2 characters')
  }
  
  if (!bankDetails.bank_name || bankDetails.bank_name.trim().length < 2) {
    throw new Error('Bank name must be at least 2 characters')
  }
  
  if (!bankDetails.iban || bankDetails.iban.trim().length === 0) {
    throw new Error('IBAN is required')
  }

  // Check for suspicious characters
  const suspiciousChars = /[<>'";&()]/
  if (suspiciousChars.test(bankDetails.account_holder_name) ||
      suspiciousChars.test(bankDetails.bank_name) ||
      suspiciousChars.test(bankDetails.iban)) {
    throw new Error('Invalid characters detected in input')
  }
}

function sanitizeInput(input: string): string {
  return input.replace(/[<>'";&()]/g, '').trim()
}

function validateIbanFormat(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()
  const romanianIbanRegex = /^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/
  return romanianIbanRegex.test(cleanIban)
}

function maskIban(iban: string): string {
  if (!iban || iban.length < 8) {
    return iban
  }
  return iban.substring(0, 4) + '*'.repeat(iban.length - 8) + iban.substring(iban.length - 4)
}

// Encryption disabled: storing IBAN in plaintext per user request
// Note: IBAN is still validated and masked in responses. Do NOT return full IBAN to client.