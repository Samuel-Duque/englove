import { redirect } from 'next/navigation';

export default function SolicitudesPage() {
  redirect('/alumnos?tab=requests');
}
