'use client';

import { useEffect, useRef, useState } from 'react';
import './landing.css';

// Pega aquí el ID del video de YouTube (lo que va después de /shorts/ o de v=). Vacío = muestra el espacio reservado.
const VIDEO_YOUTUBE_ID = 'jNzOk9k3iLE';

const bookingChat = 'https://wa.me/5215652628284?text=Quiero%20agendar%20una%20valoraci%C3%B3n%20dental';
const DURACION = [7000, 6000, 8000, 9000, 26000, 16000, 7000, null];

// Textos tomados de los mensajes reales del bot (webhook de Kapso y lib/booking-notices.mjs).
const CITA = 'lunes 17 de noviembre a las 11:00';
const CHAT = [
  { t: 0, de: 'yo', texto: 'Quiero agendar una valoración dental' },
  { t: 1800, de: 'bot', texto: '¡Hola! 😊 Qué gusto saludarte. 🦷 Elige el día y la hora que mejor te queden para tu valoración dental.\n\nPara confirmar tu cita, solo necesitamos un pago de *$0.01 MXN*. ✨', boton: 'Ver horarios' },
  { t: 4800, de: 'flow' },
  { t: 8600, de: 'bot', texto: `¡Gracias! 😊 Apartamos tu horario para el *${CITA}*.\n\nEn cuanto recibamos tu pago de *MXN 0.01*, te confirmaremos la cita por aquí. 🦷` },
  { t: 16500, de: 'bot', texto: `¡Listo! 🎉 Recibimos tu pago y tu valoración dental quedó confirmada.\n\n📅 *${CITA}*\n⏱️ *45 minutos*\n\n¡Nos vemos pronto! 🦷` },
];
const BANCO_APARECE = 10600;
const BANCO_AUTORIZA = 13600;
const PAGO_CONFIRMADO = 15800;

function Negritas({ texto }) {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith('*') && parte.endsWith('*') ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte);
}

function Simulacion({ activa }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!activa) { setT(0); return undefined; }
    const inicio = Date.now();
    const id = setInterval(() => setT(Date.now() - inicio), 100);
    return () => clearInterval(id);
  }, [activa]);
  const chatRef = useRef(null);
  const visibles = CHAT.filter((m) => t >= m.t);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibles.length]);

  const banco = t >= BANCO_APARECE && t < PAGO_CONFIRMADO;
  const autorizado = t >= BANCO_AUTORIZA;
  const confirmada = t >= PAGO_CONFIRMADO;
  const reservada = t >= 8600;

  return (
    <div className="sim">
      <div className="telefono">
        <div className="tel-barra"><span>🦷</span><div><strong>Consultorio Dental</strong><small>en línea</small></div></div>
        {banco && (
          <div className={`banco ${autorizado ? 'ok' : ''}`}>
            <div className="banco-app">🏦 Tu app bancaria · CoDi</div>
            {!autorizado ? (
              <>
                <strong>Solicitud de cobro</strong>
                <p>Consultorio Dental · Valoración dental</p>
                <p className="banco-monto">$0.01 MXN</p>
                <div className="banco-botones"><span>Rechazar</span><span className="autorizar">Autorizar</span></div>
              </>
            ) : (
              <><strong>✓ Pago enviado</strong><p>$0.01 MXN a Consultorio Dental</p></>
            )}
          </div>
        )}
        <div className="chat" ref={chatRef}>
          {visibles.map((m, i) => (
            m.de === 'flow' ? (
              <div key={i} className="flow">
                <strong>Elige tu horario</strong>
                <div className="flow-dias"><span>Sáb 15</span><span className="sel">Lun 17</span><span>Mar 18</span></div>
                <div className="flow-horas"><span>10:00</span><span className="sel">11:00</span><span>12:00</span><span>13:00</span></div>
                <span className="flow-cta">Apartar y pagar</span>
              </div>
            ) : (
              <div key={i} className={`burbuja ${m.de}`}>
                <Negritas texto={m.texto} />
                {m.boton && <span className="burbuja-boton">📋 {m.boton}</span>}
              </div>
            )
          ))}
        </div>
      </div>

      <div className="mini-panel">
        <small>Panel de Darla · Agenda</small>
        <div className="mini-slot"><time>10:00</time><span className="libre">Libre</span></div>
        <div className="mini-slot">
          <time>11:00</time>
          {reservada ? (
            <div className={`mini-cita ${confirmada ? 'verde' : 'ambar'}`}>
              <strong>Paciente ••5678</strong>
              <span className={`chip ${confirmada ? 'chip-verde' : 'chip-ambar'}`}>{confirmada ? 'Confirmada' : 'Esperando anticipo'}</span>
              <span className={`chip ${confirmada ? 'chip-verde' : 'chip-ambar'}`}>{confirmada ? 'Pagado' : 'Pago pendiente'}</span>
            </div>
          ) : <span className="libre">Libre</span>}
        </div>
        <div className="mini-slot"><time>12:00</time><span className="libre">Libre</span></div>
        <p className="mini-nota">
          {confirmada ? 'pey avisó el pago con un webhook firmado: la cita se confirmó sola.'
            : reservada ? 'Horario apartado 6 h mientras el paciente paga.'
            : 'Esperando que el paciente elija horario…'}
        </p>
      </div>
    </div>
  );
}

function SimCobro({ activa }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!activa) return undefined;
    const inicio = Date.now();
    const id = setInterval(() => setT(Date.now() - inicio), 100);
    return () => clearInterval(id);
  }, [activa]);
  const escrito = (texto, desde) => texto.slice(0, Math.max(0, Math.floor((t - desde) / 70)));
  const enviado = t >= 4200;
  const llega = t >= 5600;
  const pagado = t >= 11500;
  return (
    <div className="sim sim-cobro">
      <div className="mini-panel">
        <small>Panel de Darla · Nuevo cobro</small>
        <label className="campo">Paciente<span>Paciente ••5678</span></label>
        <label className="campo">Concepto<span>{escrito('Limpieza dental', 600) || '\u00a0'}</span></label>
        <label className="campo">Monto<span>{t > 2000 ? '$650.00 MXN' : '\u00a0'}</span></label>
        <span className={`enviar ${enviado ? 'listo' : ''}`}>{enviado ? '✓ Cobro enviado por WhatsApp' : 'Enviar cobro por WhatsApp'}</span>
        {enviado && (
          <div className="mini-slot cobro-fila">
            <strong>Limpieza dental · $650</strong>
            <span className={`chip ${pagado ? 'chip-verde' : 'chip-ambar'}`}>{pagado ? 'Pagado' : 'Esperando pago'}</span>
          </div>
        )}
        <p className="mini-nota">{pagado ? 'pey confirmó el pago: se marcó como pagado solo.' : 'La doctora no persigue a nadie: el cobro llega directo al WhatsApp del paciente.'}</p>
      </div>
      <div className="telefono">
        <div className="tel-barra"><span>🦷</span><div><strong>Consultorio Dental</strong><small>en línea</small></div></div>
        <div className="chat">
          {llega && (
            <div className="burbuja bot">
              <Negritas texto={'¡Hola! 😊 Te escribimos de Consultorio Dental. Te compartimos el cobro por *Limpieza dental*.\n\nTotal: *$650.00 MXN*. Puedes pagarlo con CoDi desde este enlace. 🦷'} />
              <span className="burbuja-boton">🔗 Abrir link de pago</span>
            </div>
          )}
          {t >= 7600 && (
            <div className="opciones-pago">
              <small>El paciente elige cómo pagar</small>
              <span className={t >= 9300 ? 'sel' : ''}>📲 Solicitud CoDi a su banco (push)</span>
              <span>🔗 Link de pago</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SLIDES = [
  (
    <>
      <p className="eyebrow">El problema</p>
      <h1>Agendar es fácil.<br />Que lleguen, no.</h1>
      <p className="lead">Consultorios, talleres, estéticas, barberías y cualquier negocio que da servicio con cita vive lo mismo: reagendas constantes y pacientes que no llegan, porque apartar no les cuesta nada.</p>
      <div className="iconos"><span>🦷 Consultorios</span><span>🔧 Talleres</span><span>💇 Estéticas</span><span>💈 Barberías</span></div>
    </>
  ),
  (
    <>
      <p className="eyebrow">La solución</p>
      <h1 className="marca-grande">Darla</h1>
      <p className="lead">La doctora agenda y pide un anticipo. El paciente aparta su cita y paga con CoDi desde WhatsApp. La cita se confirma sola cuando el banco confirma el pago.</p>
      <div className="pasos-mini"><span>📅 Agenda</span><span>→</span><span>💬 WhatsApp</span><span>→</span><span>💸 Anticipo CoDi</span><span>→</span><span>✅ Confirmada</span></div>
    </>
  ),
  (
    <>
      <p className="eyebrow">¿Por qué WhatsApp?</p>
      <h1>Donde ya están todos</h1>
      <div className="tarjetas">
        <div className="tarjeta"><strong>CoDi tiene un reto de adopción</strong><p>Millones de cuentas lo tienen activo, pero pocas personas lo usan. Hace falta llevarlo a donde la gente ya está.</p></div>
        <div className="tarjeta"><strong>WhatsApp lo usamos todos</strong><p>Sin descargar otra app ni crear cuentas. El paciente agenda en el chat que ya abre todos los días.</p></div>
        <div className="tarjeta"><strong>Un respaldo claro</strong><p>Queda por escrito cuándo, cuánto y por qué se le cobró. Sin capturas de transferencias ni dudas.</p></div>
      </div>
    </>
  ),
  (
    <>
      <p className="eyebrow">Cómo funciona</p>
      <h1>Pago real, confirmado por el banco</h1>
      <ol className="flujo">
        <li><span>1</span>El paciente escribe al WhatsApp del consultorio y elige horario en un formulario dentro del chat.</li>
        <li><span>2</span>Darla aparta el horario 6 horas y le manda una solicitud de cobro CoDi a su app bancaria.</li>
        <li><span>3</span>El paciente autoriza en su banco. pey avisa a Darla con un webhook firmado.</li>
        <li><span>4</span>La cita se confirma sola en la agenda y el paciente recibe su confirmación por WhatsApp.</li>
      </ol>
    </>
  ),
  'simulacion',
  'cobros',
  (
    <>
      <p className="eyebrow">Próximamente</p>
      <h1>Cobra en mostrador con QR</h1>
      <p className="lead">Hoy Darla cobra por WhatsApp. Pronto, la doctora, el taller o la barbería podrán generar un QR CoDi desde su panel para cobrar el saldo o un servicio en persona.</p>
      <div className="qr-pronto"><div className="qr-caja">QR CoDi</div><span className="pronto">Coming soon</span></div>
    </>
  ),
  'cierre',
];

const FONDO = [
  ['🦷', 6, 14, 0], ['🪥', 88, 18, 3], ['😁', 14, 72, 6], ['📅', 80, 70, 1.5], ['💬', 46, 8, 4.5],
  ['🦷', 64, 88, 2], ['💈', 92, 46, 7], ['✂️', 3, 44, 5], ['🔧', 30, 92, 8], ['💸', 70, 30, 9],
  ['✅', 22, 30, 10], ['🦷', 54, 56, 11],
];

function Fondo() {
  return (
    <div className="fondo" aria-hidden="true">
      <div className="mancha m1" /><div className="mancha m2" /><div className="mancha m3" />
      {FONDO.map(([icono, x, y, d], n) => (
        <span key={n} className="flota" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `-${d}s` }}>{icono}</span>
      ))}
    </div>
  );
}

export default function Home() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [verVideo, setVerVideo] = useState(false);
  const total = SLIDES.length;

  useEffect(() => {
    if (!auto || DURACION[i] == null) return undefined;
    const id = setTimeout(() => setI((x) => Math.min(x + 1, total - 1)), DURACION[i]);
    return () => clearTimeout(id);
  }, [i, auto, total]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'ArrowRight') { setAuto(false); setI((x) => Math.min(x + 1, total - 1)); }
      if (e.key === 'ArrowLeft') { setAuto(false); setI((x) => Math.max(x - 1, 0)); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [total]);

  const ir = (n) => { setAuto(false); setI(Math.max(0, Math.min(n, total - 1))); };
  const slide = SLIDES[i];

  return (
    <div className="landing">
      <Fondo />
      <header className="barra">
        <span className="logo-darla">Darla</span>
        {i < total - 1 && (
          <div className="barra-acciones">
            <a className="probar" href={bookingChat} target="_blank" rel="noreferrer">💬 Probar demo</a>
            <button className="saltar" onClick={() => ir(total - 1)}>Saltar intro →</button>
          </div>
        )}
      </header>

      <main className="escenario">
        <section key={i} className={`slide ${['simulacion', 'cobros', 'cierre'].includes(slide) ? 'ancha' : ''}`}>
          {slide === 'simulacion' ? (
            <>
              <p className="eyebrow">Así se ve</p>
              <h2>Del mensaje a la cita confirmada</h2>
              <Simulacion activa />
              <p className="aviso-sim">Simulación ilustrativa. En la demo, el pago y los mensajes son reales.</p>
            </>
          ) : slide === 'cobros' ? (
            <>
              <p className="eyebrow">Ya disponible</p>
              <h2>Cobros desde el panel, pagados por WhatsApp</h2>
              <SimCobro activa />
              <p className="aviso-sim">Simulación ilustrativa con el mensaje real que envía Darla.</p>
            </>
          ) : slide === 'cierre' ? (
            <div className="cierre">
              <div className="cierre-texto">
                <p className="eyebrow">Tu turno · pruébalo tú</p>
                <h1>Agenda una cita real en 1 minuto</h1>
                <p className="lead chico">Darla agenda, cobra y confirma por ti. Pruébala desde tu celular: el anticipo es de <strong>$0.01 MXN</strong> y es un pago real con CoDi.</p>

                <a className="cta-gigante" href={bookingChat} target="_blank" rel="noreferrer">
                  <span className="cta-icono">💬</span>
                  <span><strong>Agendar mi cita por WhatsApp</strong><small>Se abre el chat con el mensaje listo. Solo dale enviar.</small></span>
                  <span className="cta-flecha">→</span>
                </a>

                <ol className="pasos-demo">
                  <li><span className="paso-icono">💬</span><strong>Envía el mensaje</strong><small>Ya va escrito</small></li>
                  <li><span className="paso-icono">📅</span><strong>Elige día y hora</strong><small>En el formulario del chat</small></li>
                  <li><span className="paso-icono">🏦</span><strong>Autoriza $0.01</strong><small>En tu app bancaria con CoDi</small></li>
                  <li><span className="paso-icono">✅</span><strong>Mira tu cita</strong><small>Confirmada en la agenda</small></li>
                </ol>

                <a className="cta-secundario" href="/panel">
                  📅 <span><strong>Ver la agenda de Darla</strong><small>Tu cita aparece aquí y cambia a Confirmada cuando pey recibe el pago</small></span> <span className="cta-flecha">→</span>
                </a>

                <div className="beneficios">
                  <span>🙌 Menos trabajo para la doctora</span>
                  <span>⚡ Pagos al instante</span>
                  <span>📉 Menos faltas</span>
                  <span>🧾 Sin capturas</span>
                </div>
                <button className="link-repetir" onClick={() => { setI(0); setAuto(true); }}>↺ Ver la intro otra vez</button>
              </div>

              <div className="video-cel">
                {VIDEO_YOUTUBE_ID && verVideo ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${VIDEO_YOUTUBE_ID}?autoplay=1&rel=0&playsinline=1&iv_load_policy=3`}
                    title="Demo de Darla"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <button className="video-vacio" onClick={() => VIDEO_YOUTUBE_ID && setVerVideo(true)} disabled={!VIDEO_YOUTUBE_ID}>
                    <span>▶</span><strong>Video del recorrido real</strong><small>{VIDEO_YOUTUBE_ID ? 'Toca para reproducir' : 'Próximamente'}</small>
                  </button>
                )}
                <p>🎬 El recorrido real: WhatsApp, pago CoDi y cita confirmada</p>
                <div className="creditos">
                  <img src="/gracias.gif" alt="Gracias totales" />
                  <div>
                    <strong>Creado con amor 💚 by Charly R</strong>
                    <a href="https://www.linkedin.com/in/carlosruizmejia/" target="_blank" rel="noreferrer">in · Conecta en LinkedIn</a>
                  </div>
                </div>
              </div>
            </div>
          ) : slide}
        </section>
      </main>

      <footer className="controles">
        <button onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Anterior">←</button>
        <div className="puntos">
          {SLIDES.map((_, n) => (
            <button key={n} className={`punto ${n === i ? 'activo' : ''}`} onClick={() => ir(n)} aria-label={`Ir a ${n + 1}`}>
              {n === i && auto && DURACION[n] && <span style={{ animationDuration: `${DURACION[n]}ms` }} />}
            </button>
          ))}
        </div>
        <button onClick={() => setAuto((a) => !a)} aria-label={auto ? 'Pausar' : 'Reproducir'}>{auto ? '❚❚' : '▶'}</button>
        <button onClick={() => ir(i + 1)} disabled={i === total - 1} aria-label="Siguiente">→</button>
      </footer>
    </div>
  );
}
