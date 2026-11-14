const bookingChat = 'https://wa.me/5215652628284?text=Quiero%20agendar%20una%20valoraci%C3%B3n%20dental';

export default function Home() {
  return (
    <main style={{ maxWidth: 620, margin: '64px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <h1>Agenda una valoración dental</h1>
      <p>Elige una cita de 45 minutos por WhatsApp. En esta demo, el anticipo es de <strong>$0.01 MXN</strong> y se paga con CoDi.</p>
      <p><a href={bookingChat}>Abrir WhatsApp para agendar</a></p>
      <p>Envía el mensaje que aparece en WhatsApp para solicitar el formulario. La cita se confirma cuando recibimos el pago.</p>
      <hr />
      <p><a href="/panel">Ver la agenda del consultorio</a></p>
    </main>
  );
}
