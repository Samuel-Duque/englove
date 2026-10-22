import { redirect } from 'next/navigation';

export default function BloqueadosPage() {
  redirect('/alumnos?tab=locked');
}
