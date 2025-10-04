import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UpdatePayload = {
  userId: string;
  full_name?: string;
  phone?: string;
  email?: string; // optional; if provided, attempt to update auth.users as well
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check admin privileges (admin or super_admin)
    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .in("role", ["admin", "super_admin"]);

    if (rolesError || !roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as UpdatePayload;
    if (!body?.userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build update object for profiles
    const updateObj: Record<string, any> = {};
    if (typeof body.full_name === "string") updateObj.full_name = body.full_name.trim();
    if (typeof body.phone === "string") updateObj.phone = body.phone.trim();
    if (typeof body.email === "string") updateObj.email = body.email.trim();

    if (Object.keys(updateObj).length === 0) {
      return new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Update profiles using service role (bypass RLS safely)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update(updateObj)
      .eq("user_id", body.userId);

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Optionally update auth.users email if provided
    if (typeof body.email === "string" && body.email.trim().length > 0) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(body.userId, {
        email: body.email.trim(),
      });
      if (authUpdateError) {
        // Don't fail the whole request if auth email update fails; return warning
        return new Response(
          JSON.stringify({ success: true, warning: "Profile updated, but auth email change failed.", details: authUpdateError.message }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("admin-update-profile error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
