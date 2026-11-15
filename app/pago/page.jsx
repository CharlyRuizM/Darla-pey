export default async function PaymentReturn({ searchParams }) {
  if ((await searchParams)?.tipo === 'procedimiento') {
    return <main>
      <h1>Pago del consultorio</h1>
      <p>Si autorizaste el pago con CoDi, el consultorio verá la confirmación cuando se acredite.</p>
    </main>;
  }
  return (
    <main>
      <h1>Revisa el estado de tu cita</h1>
      <p>Si completaste el pago con CoDi, tu cita se confirmará cuando recibamos el pago.</p>
      <p>Si todavía no pagaste, puedes volver al enlace de pago mientras tu horario siga apartado.</p>
    </main>
  );
}
