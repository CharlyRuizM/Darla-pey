const bookingChat = 'https://wa.me/5215652628284?text=Quiero%20agendar%20una%20valoraci%C3%B3n%20dental';

export default function Home() {
  return (
    <main style={{ maxWidth: 620, margin: '64px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <h1>Agenda una valoración dental</h1>
      <ol>
        <li><a href={bookingChat}>Abrir WhatsApp</a> y enviar el mensaje preparado.</li>
        <li>Elegir una fecha y hora en el formulario que llega al chat.</li>
        <li>Pagar el anticipo de <strong>$0.01 MXN</strong> con CoDi. Es un pago real y no se devuelve.</li>
        <li><a href="/panel">Ver la cita en la agenda</a>. El estado cambia a Confirmada cuando pey avisa que recibió el pago.</li>
      </ol>
    </main>
  );
}
