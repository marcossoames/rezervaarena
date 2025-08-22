-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('client', 'facility_owner', 'admin');

-- Create enum for facility types
CREATE TYPE public.facility_type AS ENUM ('tennis', 'football', 'padel', 'swimming', 'basketball', 'volleyball');

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sports facilities table
CREATE TABLE public.facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  facility_type facility_type NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  price_per_hour DECIMAL(10,2) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  amenities TEXT[],
  images TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure no overlapping bookings for the same facility
  CONSTRAINT no_overlapping_bookings UNIQUE (facility_id, booking_date, start_time, end_time)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = _role
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.has_role('admin'));

-- RLS Policies for facilities
CREATE POLICY "Everyone can view active facilities" 
ON public.facilities FOR SELECT 
USING (is_active = true);

CREATE POLICY "Facility owners can manage their facilities" 
ON public.facilities FOR ALL 
USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all facilities" 
ON public.facilities FOR ALL 
USING (public.has_role('admin'));

-- RLS Policies for bookings
CREATE POLICY "Clients can view their own bookings" 
ON public.bookings FOR SELECT 
USING (auth.uid() = client_id);

CREATE POLICY "Clients can create bookings" 
ON public.bookings FOR INSERT 
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their pending bookings" 
ON public.bookings FOR UPDATE 
USING (auth.uid() = client_id AND status = 'pending');

CREATE POLICY "Facility owners can view bookings for their facilities" 
ON public.bookings FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.facilities 
    WHERE id = facility_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can update bookings for their facilities" 
ON public.bookings FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.facilities 
    WHERE id = facility_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all bookings" 
ON public.bookings FOR ALL 
USING (public.has_role('admin'));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_facilities_owner_id ON public.facilities(owner_id);
CREATE INDEX idx_facilities_type ON public.facilities(facility_type);
CREATE INDEX idx_facilities_city ON public.facilities(city);
CREATE INDEX idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX idx_bookings_facility_id ON public.bookings(facility_id);
CREATE INDEX idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);