'use client';

import { useMemo, useState } from 'react';
import {
  consultorio, pacientes as pacientesDemo, citas as citasDemo,
  bloqueos, cobrosIndependientes as cobrosDemo, horario,
} from '../../lib/demo-data.mjs';
import {
  diasDeAtencion, hoyMx, slotsDelDia, fechaLarga, fechaCorta, mxn, telefonoBonito,
} from '../../lib/agenda.mjs';

const ESTADO_CITA = {
  propuesta: { texto: 'Propuesta enviada', tono: 'gris' },
  pendiente_pago: { texto: 'Esperando anticipo', tono: 'ambar' },
  confirmada: { texto: 'Confirmada', tono: 'verde' },
  atendida: { texto: 'Atendida', tono: 'azul' },
  inasistencia: { texto: 'No asistió', tono: 'rojo' },
  cancelada: { texto: 'Cancelada', tono: 'rojo' },
  vencida: { texto: 'Reserva vencida', tono: 'gris' },
};
const ESTADO_PAGO = {
  sin_anticipo: { texto: 'Sin cobro aún', tono: 'gris' },
  pendiente: { texto: 'Pago pendiente', tono: 'ambar' },
  esperando: { texto: 'Esperando a pey', tono: 'ambar' },
  pagado: { texto: 'Pagado', tono: 'verde' },
  revision: { texto: 'En revisión', tono: 'rojo' },
  devolucion_pendiente: { texto: 'Devolución por gestionar', tono: 'rojo' },
  devuelto: { texto: 'Devuelto', tono: 'gris' },
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function Chip({ estado, mapa }) {
  const e = mapa[estado] || { texto: estado, tono: 'gris' };
  return <span className={`chip chip-${e.tono}`}>{e.texto}</span>;
}

export default function Panel() {
  const dias = useMemo(() => diasDeAtencion(6), []);
  const [vista, setVista] = useState('agenda');
  const [diaIdx, setDiaIdx] = useState(0);
  const [citas, setCitas] = useState(citasDemo);
  const [cobros, setCobros] = useState(cobrosDemo);
  const [pacientes, setPacientes] = useState(pacientesDemo);
  const [seleccion, setSeleccion] = useState(null);
  const [modal, setModal] = useState(null);

  const paciente = (id) => pacientes.find((p) => p.id === id);
  const actualizarCita = (id, cambios) =>
    setCitas((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambios } : c)));

  const citaSel = seleccion && citas.find((c) => c.id === seleccion);

  const hoy = citas.filter((c) => c.dia === 0 && !['cancelada', 'vencida'].includes(c.estadoCita));
  const pendientes = citas.filter((c) => ['pendiente', 'esperando'].includes(c.estadoPago)).length
    + cobros.filter((k) => ['pendiente', 'esperando'].includes(k.estadoPago)).length;
  const porAtender = citas.filter((c) => ['revision', 'devolucion_pendiente'].includes(c.estadoPago)).length;
  const cobradoHoy = citas.filter((c) => c.dia === 0 && c.estadoPago === 'pagado').reduce((s, c) => s + c.anticipo, 0)
    + cobros.filter((k) => k.fecha === 0 && k.estadoPago === 'pagado').reduce((s, k) => s + k.monto, 0);

  return (
    <div className="shell">
      <aside className="nav">
        <div className="marca">
          <span className="logo">🦷</span>
          <div>
            <strong>{consultorio.nombre}</strong>
            <small>{consultorio.dentista}</small>
          </div>
        </div>
        {[
          ['agenda', 'Agenda', '📅'],
          ['cobros', 'Cobros', '💸'],
          ['pacientes', 'Pacientes', '👥'],
          ['ajustes', 'Ajustes', '⚙️'],
        ].map(([id, texto, icono]) => (
          <button key={id} className={`nav-item ${vista === id ? 'activo' : ''}`} onClick={() => setVista(id)}>
            <span>{icono}</span>{texto}
            {id === 'cobros' && porAtender > 0 && <span className="badge">{porAtender}</span>}
          </button>
        ))}
        <p className="aviso-demo">Datos de ejemplo. Los cobros reales se confirman con el webhook de pey.</p>
      </aside>

      <main className="contenido">
        {vista === 'agenda' && (
          <>
            <header className="encabezado">
              <div>
                <h1>Agenda</h1>
                <p className="sub">{fechaLarga(dias[diaIdx])} · hora de la Ciudad de México</p>
              </div>
              <div className="acciones">
                <button className="btn secundario" onClick={() => setModal({ tipo: 'cobro' })}>Nuevo cobro</button>
                <button className="btn primario" onClick={() => setModal({ tipo: 'cita', dia: diaIdx })}>Nueva cita</button>
              </div>
            </header>

            <section className="stats">
              <div className="stat"><span>Citas {dias[0].getTime() === hoyMx().getTime() ? 'hoy' : fechaCorta(dias[0])}</span><strong>{hoy.length}</strong></div>
              <div className="stat"><span>Cobrado</span><strong>{mxn(cobradoHoy)}</strong></div>
              <div className="stat"><span>Pagos pendientes</span><strong>{pendientes}</strong></div>
              <div className={`stat ${porAtender ? 'stat-alerta' : ''}`}><span>Requieren atención</span><strong>{porAtender}</strong></div>
            </section>

            <nav className="dias">
              {dias.map((d, i) => (
                <button key={i} className={`dia ${i === diaIdx ? 'activo' : ''}`} onClick={() => setDiaIdx(i)}>
                  {d.getTime() === hoyMx().getTime() ? 'Hoy' : fechaCorta(d)}
                  <small>{citas.filter((c) => c.dia === i && !['cancelada', 'vencida'].includes(c.estadoCita)).length} citas</small>
                </button>
              ))}
            </nav>

            <ol className="slots">
              {slotsDelDia(dias[diaIdx]).map((s, idx) => {
                const cita = citas.find((c) => c.dia === diaIdx && c.slot === idx && !['cancelada', 'vencida'].includes(c.estadoCita));
                const bloqueo = bloqueos.find((b) => b.dia === diaIdx && b.slot === idx);
                const historico = citas.filter((c) => c.dia === diaIdx && c.slot === idx && ['cancelada', 'vencida'].includes(c.estadoCita));
                return (
                  <li key={idx} className="slot">
                    <time>{s.inicio}<small>{s.fin}</small></time>
                    <div className="slot-cuerpo">
                      {cita ? (
                        <button className={`cita cita-${ESTADO_CITA[cita.estadoCita].tono}`} onClick={() => setSeleccion(cita.id)}>
                          <div className="cita-linea">
                            <strong>{paciente(cita.pacienteId).nombre}</strong>
                            <span className="origen">{cita.origen === 'whatsapp' ? 'Desde WhatsApp' : 'Desde el consultorio'}</span>
                          </div>
                          <div className="cita-linea">
                            <span className="muted">{consultorio.servicio} · anticipo {mxn(cita.anticipo)}</span>
                            <span className="chips">
                              <Chip estado={cita.estadoCita} mapa={ESTADO_CITA} />
                              <Chip estado={cita.estadoPago} mapa={ESTADO_PAGO} />
                            </span>
                          </div>
                        </button>
                      ) : bloqueo ? (
                        <div className="bloqueo">{bloqueo.motivo}</div>
                      ) : (
                        <button className="libre" onClick={() => setModal({ tipo: 'cita', dia: diaIdx, slot: idx })}>
                          + Agendar a las {s.inicio}
                        </button>
                      )}
                      {historico.map((h) => (
                        <button key={h.id} className="historico" onClick={() => setSeleccion(h.id)}>
                          {paciente(h.pacienteId).nombre} · <Chip estado={h.estadoCita} mapa={ESTADO_CITA} /> <Chip estado={h.estadoPago} mapa={ESTADO_PAGO} />
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {vista === 'cobros' && (
          <Cobros citas={citas} cobros={cobros} paciente={paciente} dias={dias}
            abrirCita={setSeleccion} nuevo={() => setModal({ tipo: 'cobro' })} />
        )}

        {vista === 'pacientes' && (
          <Pacientes pacientes={pacientes} citas={citas} cobros={cobros}
            cobrar={(p) => setModal({ tipo: 'cobro', pacienteId: p.id })}
            agendar={(p) => setModal({ tipo: 'cita', dia: 0, pacienteId: p.id })} />
        )}

        {vista === 'ajustes' && <Ajustes />}
      </main>

      {citaSel && (
        <Detalle cita={citaSel} paciente={paciente(citaSel.pacienteId)} dia={dias[citaSel.dia]}
          slot={slotsDelDia(dias[citaSel.dia])[citaSel.slot]}
          cerrar={() => setSeleccion(null)}
          actualizar={(cambios) => actualizarCita(citaSel.id, cambios)}
          cobrarSaldo={() => setModal({
            tipo: 'cobro', pacienteId: citaSel.pacienteId, citaId: citaSel.id,
            concepto: `Saldo ${consultorio.servicio.toLowerCase()}`,
            monto: consultorio.precioServicio - citaSel.anticipo,
          })} />
      )}

      {modal?.tipo === 'cobro' && (
        <ModalCobro {...modal} pacientes={pacientes} cerrar={() => setModal(null)}
          enviar={(cobro) => {
            setCobros((ks) => [...ks, { id: `k${Date.now()}`, fecha: 0, estadoPago: 'esperando', ...cobro }]);
            if (cobro.citaId) actualizarCita(cobro.citaId, { saldoSolicitado: true });
          }} />
      )}

      {modal?.tipo === 'cita' && (
        <ModalCita {...modal} dias={dias} citas={citas} pacientes={pacientes} cerrar={() => setModal(null)}
          crear={({ paciente: p, ...cita }) => {
            let pacienteId = p.id;
            if (!pacienteId) {
              pacienteId = `p${Date.now()}`;
              setPacientes((ps) => [...ps, { ...p, id: pacienteId }]);
            }
            setCitas((cs) => [...cs, {
              id: `c${Date.now()}`, pacienteId, estadoCita: 'propuesta', estadoPago: 'sin_anticipo', origen: 'consultorio', ...cita,
            }]);
            setModal(null);
          }} />
      )}
    </div>
  );
}

function Detalle({ cita, paciente, dia, slot, cerrar, actualizar, cobrarSaldo }) {
  const saldo = consultorio.precioServicio - cita.anticipo;
  const c = cita.estadoCita;
  return (
    <div className="capa" onClick={cerrar}>
      <aside className="panel-lateral" onClick={(e) => e.stopPropagation()}>
        <button className="cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        <p className="sub">{fechaLarga(dia)} · {slot?.inicio}–{slot?.fin}</p>
        <h2>{paciente.nombre}</h2>
        <p className="muted">📱 {telefonoBonito(paciente.telefono)}</p>
        <div className="chips"><Chip estado={c} mapa={ESTADO_CITA} /><Chip estado={cita.estadoPago} mapa={ESTADO_PAGO} /></div>

        {cita.nota && <p className="nota">{cita.nota}</p>}

        <dl className="resumen">
          <dt>Servicio</dt><dd>{consultorio.servicio}</dd>
          <dt>Precio</dt><dd>{mxn(consultorio.precioServicio)}</dd>
          <dt>Anticipo</dt><dd>{mxn(cita.anticipo)} · <Chip estado={cita.estadoPago} mapa={ESTADO_PAGO} /></dd>
          <dt>Saldo en consultorio</dt>
          <dd>{cita.saldoPagado ? 'Pagado' : cita.saldoSolicitado ? 'Solicitado, esperando a pey' : mxn(saldo)}</dd>
        </dl>

        {c === 'pendiente_pago' && (
          <div className="caja">
            <strong>Horario retenido</strong>
            <p>Quedan {Math.floor((cita.retencionRestanteMin ?? 360) / 60)} h {(cita.retencionRestanteMin ?? 360) % 60} min antes de liberarlo.
              A las 4 h se envía un recordatorio por WhatsApp, una sola vez.</p>
            <p className="muted">La cita se confirma sola cuando pey avisa que el pago llegó.</p>
          </div>
        )}
        {c === 'propuesta' && (
          <div className="caja"><strong>Esperando respuesta</strong><p>El paciente puede aceptar, rechazar o pedir otro horario desde WhatsApp. Al aceptar recibe la solicitud de pago.</p></div>
        )}

        <div className="acciones-col">
          {(c === 'confirmada' || c === 'atendida') && !cita.saldoPagado && !cita.saldoSolicitado && (
            <button className="btn primario grande" onClick={cobrarSaldo}>Cobrar saldo de {mxn(saldo)} con CoDi</button>
          )}
          {c === 'confirmada' && (
            <div className="fila">
              <button className="btn secundario" onClick={() => actualizar({ estadoCita: 'atendida' })}>Llegó</button>
              <button className="btn secundario" onClick={() => actualizar({ estadoCita: 'inasistencia' })}>No asistió</button>
            </div>
          )}
          {['propuesta', 'pendiente_pago', 'confirmada'].includes(c) && (
            <button className="btn secundario">Proponer otro horario</button>
          )}
          {c === 'pendiente_pago' && <button className="btn secundario">Reenviar solicitud de pago</button>}
          {cita.estadoPago === 'devolucion_pendiente' && (
            <>
              <button className="btn secundario">Ofrecer reagendar conservando anticipo</button>
              <button className="btn secundario" onClick={() => actualizar({ estadoPago: 'devuelto' })}>Marcar devolución hecha</button>
            </>
          )}
          {cita.estadoPago === 'revision' && (
            <button className="btn secundario">Revisar pago tardío</button>
          )}
          {['propuesta', 'pendiente_pago', 'confirmada'].includes(c) && (
            <button className="btn peligro" onClick={() => actualizar({
              estadoCita: 'cancelada',
              estadoPago: cita.estadoPago === 'pagado' ? 'devolucion_pendiente' : cita.estadoPago,
              nota: cita.estadoPago === 'pagado' ? 'Cancelada por el consultorio: ofrecer reagendar o gestionar devolución.' : undefined,
            })}>Cancelar cita</button>
          )}
        </div>
      </aside>
    </div>
  );
}

function ModalCobro({ pacientes, pacienteId, citaId, concepto: conceptoInicial = '', monto: montoInicial = '', cerrar, enviar }) {
  const [pid, setPid] = useState(pacienteId || pacientes[0].id);
  const [concepto, setConcepto] = useState(conceptoInicial);
  const [monto, setMonto] = useState(String(montoInicial));
  const [demo, setDemo] = useState(false);
  const [canal, setCanal] = useState('push');
  const [enviado, setEnviado] = useState(false);
  const p = pacientes.find((x) => x.id === pid);
  const montoFinal = demo ? 0.01 : Number(monto);
  const valido = concepto.trim() && montoFinal > 0;

  return (
    <div className="capa" onClick={cerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        {!enviado ? (
          <>
            <h2>Cobrar con CoDi</h2>
            <label>Paciente
              <select value={pid} onChange={(e) => setPid(e.target.value)} disabled={!!citaId}>
                {pacientes.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {telefonoBonito(x.telefono)}</option>)}
              </select>
            </label>
            <label>Concepto
              <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Resina en molar" />
            </label>
            <label>Monto (MXN)
              <input type="number" min="1" value={demo ? '0.01' : monto} disabled={demo} onChange={(e) => setMonto(e.target.value)} />
            </label>
            <label className="check"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Cobro de demostración: $0.01 MXN real</label>

            <div className="canales">
              <button className={`canal ${canal === 'push' ? 'activo' : ''}`} onClick={() => setCanal('push')}>
                <strong>📲 Al celular del paciente</strong>
                <small>Le llega la solicitud a su app bancaria al {telefonoBonito(p.telefono)}</small>
              </button>
              <button className={`canal ${canal === 'qr' ? 'activo' : ''}`} onClick={() => setCanal('qr')}>
                <strong>🔳 QR en esta pantalla</strong>
                <small>El paciente lo escanea con su banco aquí en el consultorio</small>
              </button>
            </div>

            <button className="btn primario grande" disabled={!valido}
              onClick={() => { enviar({ pacienteId: pid, citaId, concepto, monto: montoFinal, canal }); setEnviado(true); }}>
              {canal === 'push' ? 'Enviar solicitud' : 'Generar QR'} por {mxn(montoFinal || 0)}
            </button>
          </>
        ) : (
          <div className="esperando">
            {canal === 'qr' ? (
              <div className="qr-lugar">El QR dinámico de pey aparece aquí</div>
            ) : (
              <div className="pulso">📲</div>
            )}
            <h2>{canal === 'qr' ? 'Muestra este QR al paciente' : `Solicitud enviada a ${p.nombre.split(' ')[0]}`}</h2>
            <p>{concepto} · <strong>{mxn(montoFinal)}</strong></p>
            <p className="muted"><span className="spinner" /> Esperando la confirmación de pey. El cobro se marca como pagado solo cuando llega el aviso verificado.</p>
            <button className="btn secundario" onClick={cerrar}>Listo, seguir trabajando</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalCita({ dias, citas, pacientes, dia = 0, slot, pacienteId, cerrar, crear }) {
  const [busqueda, setBusqueda] = useState('');
  const [pid, setPid] = useState(pacienteId || null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [d, setD] = useState(dia);
  const [s, setS] = useState(slot ?? null);
  const [anticipo, setAnticipo] = useState(consultorio.anticipos[1]);
  const [otro, setOtro] = useState('');

  const digitos = busqueda.replace(/\D/g, '');
  const encontrados = busqueda
    ? pacientes.filter((p) => p.telefono.includes(digitos || '¬') || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : [];
  const esNuevo = !pid && digitos.length === 10 && !pacientes.some((p) => p.telefono === digitos);
  const ocupados = new Set(citas.filter((c) => c.dia === d && !['cancelada', 'vencida'].includes(c.estadoCita)).map((c) => c.slot));
  bloqueos.filter((b) => b.dia === d).forEach((b) => ocupados.add(b.slot));
  const montoFinal = anticipo === 'otro' ? Number(otro) : anticipo;
  const pacienteListo = pid || (esNuevo && nuevoNombre.trim());
  const valido = pacienteListo && s !== null && montoFinal > 0;
  const elegido = pacientes.find((p) => p.id === pid);

  return (
    <div className="capa" onClick={cerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        <h2>Nueva cita · {consultorio.servicio}</h2>

        {elegido ? (
          <div className="elegido">
            <span><strong>{elegido.nombre}</strong> · {telefonoBonito(elegido.telefono)}</span>
            {!pacienteId && <button className="link" onClick={() => setPid(null)}>Cambiar</button>}
          </div>
        ) : (
          <>
            <label>Paciente (teléfono o nombre)
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="55 1234 5678" inputMode="search" />
            </label>
            {encontrados.map((p) => (
              <button key={p.id} className="resultado" onClick={() => setPid(p.id)}>{p.nombre} · {telefonoBonito(p.telefono)}</button>
            ))}
            {esNuevo && (
              <label>Paciente nuevo, ¿cómo se llama?
                <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre completo" />
              </label>
            )}
          </>
        )}

        <label>Día</label>
        <div className="opciones">
          {dias.map((x, i) => (
            <button key={i} className={`opcion ${d === i ? 'activo' : ''}`} onClick={() => { setD(i); setS(null); }}>{fechaCorta(x)}</button>
          ))}
        </div>
        <label>Horario (45 min)</label>
        <div className="opciones">
          {slotsDelDia(dias[d]).map((x, i) => (
            <button key={i} disabled={ocupados.has(i)} className={`opcion ${s === i ? 'activo' : ''}`} onClick={() => setS(i)}>{x.inicio}</button>
          ))}
        </div>
        <p className="muted pequeño">Las citas con anticipo deben ser a más de 6 horas de distancia.</p>

        <label>Anticipo</label>
        <div className="opciones">
          {consultorio.anticipos.map((a) => (
            <button key={a} className={`opcion ${anticipo === a ? 'activo' : ''}`} onClick={() => setAnticipo(a)}>{mxn(a)}</button>
          ))}
          <button className={`opcion ${anticipo === 0.01 ? 'activo' : ''}`} onClick={() => setAnticipo(0.01)}>Demo $0.01</button>
          <button className={`opcion ${anticipo === 'otro' ? 'activo' : ''}`} onClick={() => setAnticipo('otro')}>Otro</button>
        </div>
        {anticipo === 'otro' && <input type="number" min="1" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Monto en MXN" />}

        <button className="btn primario grande" disabled={!valido}
          onClick={() => crear({
            paciente: elegido || { nombre: nuevoNombre.trim(), telefono: digitos },
            dia: d, slot: s, anticipo: montoFinal,
          })}>
          Enviar propuesta por WhatsApp
        </button>
        <p className="muted pequeño">El paciente acepta, rechaza o pide otro horario. La cita se confirma cuando pague el anticipo.</p>
      </div>
    </div>
  );
}

function Cobros({ citas, cobros, paciente, dias, abrirCita, nuevo }) {
  const [filtro, setFiltro] = useState('atencion');
  const filas = [
    ...citas.filter((c) => c.estadoPago !== 'sin_anticipo').map((c) => ({
      id: c.id, citaId: c.id, nombre: paciente(c.pacienteId).nombre,
      concepto: `Anticipo · ${fechaCorta(dias[c.dia])} ${slotsDelDia(dias[c.dia])[c.slot]?.inicio}`,
      monto: c.anticipo, estado: c.estadoPago,
    })),
    ...cobros.map((k) => ({
      id: k.id, nombre: paciente(k.pacienteId).nombre, concepto: k.concepto, monto: k.monto,
      estado: k.estadoPago, canal: k.canal,
    })),
  ];
  const grupos = {
    atencion: ['revision', 'devolucion_pendiente'],
    pendientes: ['pendiente', 'esperando'],
    pagados: ['pagado', 'devuelto'],
  };
  const visibles = filas.filter((f) => grupos[filtro].includes(f.estado));

  return (
    <>
      <header className="encabezado">
        <div><h1>Cobros</h1><p className="sub">Anticipos y cobros por procedimiento</p></div>
        <div className="acciones"><button className="btn primario" onClick={nuevo}>Nuevo cobro</button></div>
      </header>
      <nav className="filtros">
        {[['atencion', 'Requieren atención'], ['pendientes', 'Pendientes'], ['pagados', 'Pagados']].map(([id, t]) => (
          <button key={id} className={`filtro ${filtro === id ? 'activo' : ''}`} onClick={() => setFiltro(id)}>
            {t} <span>{filas.filter((f) => grupos[id].includes(f.estado)).length}</span>
          </button>
        ))}
      </nav>
      <ul className="lista">
        {visibles.length === 0 && <li className="vacio">Nada por aquí.</li>}
        {visibles.map((f) => (
          <li key={f.id}>
            <button className="fila-lista" onClick={() => f.citaId && abrirCita(f.citaId)}>
              <div><strong>{f.nombre}</strong><small>{f.concepto}{f.canal ? ` · ${f.canal === 'qr' ? 'QR' : 'al celular'}` : ''}</small></div>
              <div className="derecha"><strong>{mxn(f.monto)}</strong><Chip estado={f.estado} mapa={ESTADO_PAGO} /></div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Pacientes({ pacientes, citas, cobros, cobrar, agendar }) {
  const [q, setQ] = useState('');
  const digitos = q.replace(/\D/g, '');
  const lista = pacientes.filter((p) => !q || (digitos && p.telefono.includes(digitos)) || p.nombre.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <header className="encabezado"><div><h1>Pacientes</h1><p className="sub">{pacientes.length} registrados</p></div></header>
      <input className="buscador" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por teléfono o nombre" />
      <ul className="lista">
        {lista.map((p) => {
          const susCitas = citas.filter((c) => c.pacienteId === p.id);
          const pagado = susCitas.filter((c) => c.estadoPago === 'pagado').reduce((s, c) => s + c.anticipo, 0)
            + cobros.filter((k) => k.pacienteId === p.id && k.estadoPago === 'pagado').reduce((s, k) => s + k.monto, 0);
          return (
            <li key={p.id} className="fila-lista estatica">
              <div><strong>{p.nombre}</strong><small>{telefonoBonito(p.telefono)} · {susCitas.length} citas · {mxn(pagado)} pagado</small></div>
              <div className="derecha fila">
                <button className="btn secundario chico" onClick={() => agendar(p)}>Agendar</button>
                <button className="btn secundario chico" onClick={() => cobrar(p)}>Cobrar</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Ajustes() {
  return (
    <>
      <header className="encabezado"><div><h1>Ajustes</h1><p className="sub">Horario, anticipos y políticas</p></div></header>
      <section className="tarjeta">
        <h3>Horario de atención</h3>
        <ul className="horario">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <li key={d}><span>{DIAS_SEMANA[d]}</span><span>{horario[d] ? `${horario[d][0]} – ${horario[d][1]}` : 'Cerrado'}</span></li>
          ))}
        </ul>
        <button className="btn secundario chico">Agregar bloqueo</button>
      </section>
      <section className="tarjeta">
        <h3>Anticipo de {consultorio.servicio.toLowerCase()}</h3>
        <p>Precio {mxn(consultorio.precioServicio)} · opciones {consultorio.anticipos.map(mxn).join(', ')} u otro monto.</p>
      </section>
      <section className="tarjeta">
        <h3>Políticas que ve el paciente antes de pagar</h3>
        <ul className="politicas">
          <li>El horario se aparta 6 horas mientras pagas. A las 4 horas te recordamos una vez.</li>
          <li>Puedes reagendar hasta 24 horas antes y conservas tu anticipo.</li>
          <li>Si cancelas, el anticipo no se devuelve.</li>
          <li>Si el consultorio cancela, puedes reagendar o pedir la devolución.</li>
        </ul>
      </section>
    </>
  );
}
