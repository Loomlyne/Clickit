import { redirect } from 'next/navigation'

// Redirect /series listing to home until viewer pages are fully connected to Supabase
export default function SeriesPage() {
  redirect('/')
}

