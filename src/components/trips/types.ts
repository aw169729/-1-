export interface Trip {
  id: string;
  trip_number: string;
  client: string | null;
  passenger_name: string | null;
  origin: string | null;
  destination: string | null;
  price: number | null;
  phone: string | null;
  trip_date: string | null;
  created_at: string;
  billing_month?: string | null;
  client_id?: string | null;
  notes?: string | null;
}