'use client';

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

import { useEffect, useMemo, useRef, useState } from 'react';
import { consultorio, horario } from '../../lib/demo-data.mjs';
import { diasDeAtencion, hoyMx, slotsDelDia, fechaLarga, fechaCorta, mxn } from '../../lib/agenda.mjs';
import { panelAppointments } from '../../lib/panel-agenda.mjs';

const regionNames = new Intl.DisplayNames('es-MX', { type: 'region' });
const countries = getCountries().map((id) => ({
  id, name: regionNames.of(id), code: '+' + getCountryCallingCode(id),
})).sort((a, b) => a.name.localeCompare(b.name, 'es-MX'));
const normalized = (value) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const ESTADO_CITA = {
  propuesta: { texto: 'Propuesta enviada', tono: 'gris' },
  aceptada: { texto: 'Propuesta aceptada', tono: 'gris' },
  rechazada: { texto: 'Propuesta rechazada', tono: 'gris' },
  otro_horario: { texto: 'Pidió otro horario', tono: 'gris' },
  envio_fallido: { texto: 'Envío sin confirmar', tono: 'rojo' },
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
  const anterior = useRef(estado);
  const elemento = useRef(null);
  useEffect(() => {
    const cambio = anterior.current !== estado;
    anterior.current = estado;
    if (!cambio || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = elemento.current?.animate(
      [{ transform: "scale(.94)", opacity: .65 }, { transform: "scale(1.06)", opacity: 1 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 340, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [estado]);
  const e = mapa[estado] || { texto: estado, tono: 'gris' };
  return <span ref={elemento} className={`chip chip-${e.tono}`}>{e.texto}</span>;
}

export default function Panel() {
  const dias = useMemo(() => diasDeAtencion(6), []);
  const [vista, setVista] = useState('agenda');
  const [diaIdx, setDiaIdx] = useState(0);
  const [rows, setRows] = useState([]);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const [modal, setModal] = useState(null);
  const [sent, setSent] = useState(null);
  const [sentCharge, setSentCharge] = useState(false);
  const from = dias[0].toISOString().slice(0, 10);
  const to = dias.at(-1).toISOString().slice(0, 10);

  useEffect(() => {
    let active = true;
    let inFlight;
    async function actualizar() {
      if (!active || document.visibilityState !== 'visible' || inFlight) return;
      setNow(Date.now());
      const controller = new AbortController();
      inFlight = controller;
      try {
        const response = await fetch(`/api/panel/agenda?from=${from}&to=${to}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('agenda');
        const data = await response.json();
        if (active) { setRows(data.appointments); setError(false); }
      } catch {
        if (active) setError(true);
      } finally {
        inFlight = undefined;
      }
    }
    actualizar();
    const interval = setInterval(actualizar, 5000);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      active = false;
      inFlight?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, [from, to]);

  const citas = panelAppointments(rows, dias, now);
  const pacientes = citas.map((cita) => cita.paciente);
  const paciente = (id) => pacientes.find((p) => p.id === id);
  const citaSel = citas.find((c) => c.id === seleccion);
  const citasDia = citas.filter((c) => c.dia === diaIdx);
  const hoy = citasDia.filter((c) => !['cancelada', 'vencida'].includes(c.estadoCita));
  const pendientes = citasDia.filter((c) => c.estadoPago === 'pendiente').length;
  const porAtender = 0;
  const cobradoHoy = citasDia.filter((c) => c.estadoCita === 'confirmada').reduce((s, c) => s + c.anticipo, 0);

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
          ['historial', 'Historial', '🗂️'],
          ['cobros', 'Cobros', '💸'],
          ['pacientes', 'Pacientes', '👥'],
          ['ajustes', 'Ajustes', '⚙️'],
        ].map(([id, texto, icono]) => (
          <button key={id} className={`nav-item ${vista === id ? 'activo' : ''}`} onClick={() => setVista(id)}>
            <span>{icono}</span>{texto}
            {id === 'cobros' && porAtender > 0 && <span className="badge">{porAtender}</span>}
          </button>
        ))}
        <p className="aviso-demo">Los cobros se confirman con el webhook de pey.</p>
      </aside>

      <main className="contenido">
        {sent && <div className="proposal-success" role="status">
          <span><strong>{sentCharge ? 'Cobro enviado por WhatsApp' : 'Propuesta enviada por WhatsApp'}</strong><br />
          Al número {sent}. {sentCharge ? 'El pago está pendiente.' : 'La cita queda pendiente de aceptación.'}</span>
          <button type="button" className="btn secundario chico" onClick={() => setSent(null)}>Cerrar</button>
        </div>}
        {error && <p className="muted pequeño" role="status">No se pudo actualizar la agenda</p>}
        {vista === 'agenda' && (
          <>
            <header className="encabezado">
              <div>
                <h1>Agenda</h1>
                <p className="sub">{fechaLarga(dias[diaIdx])} · hora de la Ciudad de México</p>
              </div>
              <div className="acciones">
                <button className="btn secundario" onClick={() => setModal({ cobro: true })}>Nuevo cobro</button>
                <button className="btn primario" onClick={() => setModal({ dia: diaIdx })}>Nueva cita</button>
              </div>
            </header>

            <section className="stats">
              <div className="stat"><span>Citas {dias[diaIdx].getTime() === hoyMx().getTime() ? 'hoy' : fechaCorta(dias[diaIdx])}</span><strong>{hoy.length}</strong></div>
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
                const cita = citas.find((c) => c.dia === diaIdx && c.slot === idx && !['cancelada', 'vencida', 'propuesta'].includes(c.estadoCita));
                const historico = citas.filter((c) => c.dia === diaIdx && c.slot === idx && ['cancelada', 'vencida', 'propuesta'].includes(c.estadoCita));
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
                      ) : (
                        <button className="libre" onClick={() => setModal({ dia: diaIdx, slot: idx })}>
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

        {vista === 'historial' && <Historial />}
        {vista === 'cobros' && <Cobros citas={citas} paciente={paciente} dias={dias} abrirCita={setSeleccion} nuevo={() => setModal({ cobro: true })} />}
        {vista === 'pacientes' && <Pacientes pacientes={pacientes} citas={citas} />}
        {vista === 'ajustes' && <Ajustes />}
      </main>

      {modal?.cobro && <ModalCobroProcedimiento cerrar={() => setModal(null)} enviado={(maskedPhone) => {
        setSentCharge(true);
        setSent(maskedPhone);
        setModal(null);
        setVista('cobros');
      }} />}
      {modal && !modal.cobro && <ModalPropuesta dias={dias} initialDay={modal.dia}
        initialSlot={modal.slot} citas={citas} cerrar={() => setModal(null)} enviada={(row) => {
          setRows((actuales) => [...actuales.filter((c) => c.id !== row.id), row]);
          setSentCharge(false);
          setSent(row.whatsapp_phone);
          setModal(null);
        }} />}
      {citaSel && (
        <Detalle cita={citaSel} paciente={citaSel.paciente} dia={dias[citaSel.dia]}
          slot={slotsDelDia(dias[citaSel.dia])[citaSel.slot]}
          cerrar={() => setSeleccion(null)} />
      )}
    </div>
  );
}

function ModalPropuesta({ dias, initialDay, initialSlot, citas, cerrar, enviada }) {
  const [dia, setDia] = useState(initialDay);
  const [slot, setSlot] = useState(initialSlot ?? null);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('MX');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const selectedCountry = countries.find(({ id }) => id === country);
  const countryMatches = countries.filter(({ name, code, id }) =>
    normalized(`${name} ${code} ${id}`).includes(normalized(countryQuery.trim())));
  const parsedPhone = parsePhoneNumberFromString(phone, { defaultCountry: country, extract: false });
  const validPhone = parsedPhone?.isPossible() && (phone.trim().startsWith('+') || parsedPhone.countryCallingCode === selectedCountry.code.slice(1));
  const [preset, setPreset] = useState('0.01');
  const [custom, setCustom] = useState('');
  const deposit = (preset === 'otro' ? custom.trim() : preset).replace(',', '.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fecha = dias[dia].toISOString().slice(0, 10);
  const horarios = slotsDelDia(dias[dia]);
  const startsAt = horarios[slot] && `${fecha}T${horarios[slot].inicio}:00-06:00`;
  const disponible = (i) => Date.parse(`${fecha}T${horarios[i].inicio}:00-06:00`) > Date.now() + 21600000
    && !citas.some((c) => c.dia === dia && c.slot === i && ['confirmada', 'pendiente_pago'].includes(c.estadoCita));
  const cents = Math.round(Number(deposit) * 100);
  const ready = validPhone && /^\d+(\.\d{1,2})?$/.test(deposit)
    && cents >= 1 && cents <= consultorio.precioServicio * 100 && !!startsAt && disponible(slot);
  async function enviar(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/panel/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: parsedPhone.number, startsAt, depositCents: cents, consent: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError({
          wait_before_resending: 'Ya hay una propuesta pendiente para ese número y horario. Revisa WhatsApp o elige otro horario.',
          slot_unavailable: 'Ese horario ya no está disponible. Elige otro.',
          contact_window_closed: 'Abre WhatsApp desde la portada y escribe al consultorio con el número que ingresaste.',
        }[result.error] || 'No pudimos verificar el envío. Revisa el chat antes de reintentar.');
        return;
      }
      const last4 = parsedPhone.number.slice(-4);
      enviada({ id: result.id, status: 'invited', starts_at: startsAt, deposit_cents: cents,
        patient_name: `Paciente ••${last4}`, whatsapp_phone: `•••• ${last4}` });
    } catch {
      setError('No pudimos verificar el envío. Revisa el chat antes de reintentar.');
    } finally { setBusy(false); }
  }
  return <div className="capa" onClick={busy ? undefined : cerrar}>
    <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
      <button type="button" className="cerrar" onClick={cerrar} disabled={busy} aria-label="Cerrar">×</button>
      <h2>Nueva cita · {consultorio.servicio}</h2>
      <div>
        <label htmlFor="proposal-phone">WhatsApp del paciente</label>
        <div className="proposal-phone-row">
          <button type="button" className="btn secundario" aria-expanded={countryOpen}
            aria-controls="proposal-countries" onClick={() => { setCountryOpen(!countryOpen); setCountryQuery(''); }}>
            {selectedCountry.name} {selectedCountry.code} ▾
          </button>
          <input id="proposal-phone" type="tel" autoComplete="tel-national" value={phone}
            placeholder={country === 'MX' ? '55 1234 5678' : 'Número de WhatsApp'} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {countryOpen && <div id="proposal-countries" className="proposal-countries"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setCountryOpen(false); } }}>
          <input autoFocus value={countryQuery} aria-label="Buscar país o código" placeholder="Buscar país o código"
            onChange={(e) => setCountryQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
          <ul>{countryMatches.map((item) => <li key={item.id}>
            <button type="button" className="resultado" onClick={() => { setCountry(item.id); setCountryOpen(false); }}>
              {item.name} <span>{item.code}</span>
            </button>
          </li>)}</ul>
          {!countryMatches.length && <p className="muted pequeño">No encontramos ese país o código.</p>}
        </div>}
        {phone.trim() && !validPhone && <p className="muted pequeño">Revisa el número o selecciona su país.</p>}
      </div>
      <label>Día</label>
      <div className="opciones">{dias.map((date, i) =>
        <button type="button" key={i} className={`opcion ${dia === i ? 'activo' : ''}`} onClick={() => { setDia(i); setSlot(null); }}>{fechaCorta(date)}</button>)}</div>
      <label>Horario (45 min)</label>
      <div className="opciones">{horarios.map(({ inicio }, i) =>
        <button type="button" key={inicio} disabled={!disponible(i)} className={`opcion ${slot === i ? 'activo' : ''}`} onClick={() => setSlot(i)}>{inicio}</button>)}</div>
      <label>Anticipo
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="0.01">$0.01 MXN · Demo</option>
          {consultorio.anticipos.map((amount) => <option key={amount} value={amount}>{mxn(amount)} MXN</option>)}
          <option value="otro">Otro monto</option>
        </select>
      </label>
      {preset === 'otro' && <label>Monto en MXN
        <input type="text" inputMode="decimal" placeholder="Ej. 150.00" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <small>De $0.01 a {mxn(consultorio.precioServicio)} MXN.</small>
      </label>}
      {error && <p role="alert">{error}</p>}
      <button className="btn primario grande" disabled={!ready || busy}>{busy ? 'Enviando…' : 'Enviar propuesta por WhatsApp'}</button>
      <p className="muted pequeño">Envía la propuesta a tu número o al de un paciente que haya autorizado recibirla. El anticipo solo se solicita cuando el paciente acepta.</p>
    </form>
  </div>;
}

function PanelLateral({ cerrar, children }) {
  return <div className="capa" onClick={cerrar}>
    <aside className="panel-lateral" role="dialog" aria-label="Detalle de la cita" onClick={(e) => e.stopPropagation()}>
      <button className="cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
      {children}
    </aside>
  </div>;
}

const historyDate = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short',
});

const historyFilters = [
  ['all', 'Todas'], ['confirmed', 'Confirmadas'], ['pending', 'Esperando pago'],
  ['closed', 'Vencidas o canceladas'], ['proposals', 'Propuestas'],
];

function Historial() {
  const [filter, setFilter] = useState('all');
  const [pages, setPages] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function load() {
      if (controller.signal.aborted || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const entries = [];
        let cursor;
        let hasInvitations = false;
        for (let page = 0; page < pages; page++) {
          const query = new URLSearchParams({ status: filter });
          if (cursor) query.set('cursor', cursor);
          const response = await fetch('/api/panel/history?' + query, {
            cache: 'no-store', signal: controller.signal,
          });
          if (!response.ok) throw new Error('history');
          const result = await response.json();
          entries.push(...result.entries);
          cursor = result.nextCursor;
          hasInvitations = result.hasInvitations;
          if (!cursor) break;
        }
        if (controller.signal.aborted) return;
        setData({ entries, cursor, hasInvitations, filter });
        setSelected((prior) => prior && (entries.find(({ key }) => key === prior.key) || prior));
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [filter, pages]);

  const entries = data?.filter === filter ? data.entries : [];
  return <>
    <header className="encabezado">
      <div><h1>Historial</h1><p className="sub">Citas y propuestas por WhatsApp · hora de la Ciudad de México</p></div>
    </header>
    <nav className="filtros" aria-label="Filtrar historial">
      {historyFilters.filter(([id]) => id !== 'proposals' || data?.hasInvitations).map(([id, label]) =>
        <button key={id} className={`filtro ${id === filter ? 'activo' : ''}`} aria-pressed={id === filter}
          onClick={() => { if (id !== filter) { setLoading(true); setError(false); setFilter(id); setPages(1); } }}>
          {label}
        </button>)}
    </nav>
    {error && <p className="muted pequeño" role="status">No se pudo actualizar el historial. Volveremos a intentarlo.</p>}
    <ul className="lista">
      {!entries.length && <li className="vacio">{loading ? 'Cargando historial…' : error ? 'Historial no disponible por ahora.' : 'No hay registros en esta vista.'}</li>}
      {entries.map((entry) => <li key={entry.key}>
        <button className="fila-lista" onClick={() => setSelected(entry)}>
          <div><strong>{entry.nombre}</strong><small>{historyDate.format(new Date(entry.startsAt))}</small><small>{entry.origen}</small></div>
          <div className="derecha"><strong>{mxn(entry.anticipo)}</strong>
            <div className="chips"><Chip estado={entry.estadoCita} mapa={ESTADO_CITA} /><Chip estado={entry.estadoPago} mapa={ESTADO_PAGO} /></div>
          </div>
        </button>
      </li>)}
    </ul>
    {data?.filter === filter && data.cursor && <button className="btn secundario" disabled={loading}
      onClick={() => { setLoading(true); setPages((count) => count + 1); }}>{loading ? 'Cargando…' : 'Ver más'}</button>}
    {selected && <PanelLateral cerrar={() => setSelected(null)}>
      <p className="sub">{historyDate.format(new Date(selected.startsAt))} · CDMX</p>
      <h2>{selected.nombre}</h2>
      {selected.telefono && <p className="muted">📱 {selected.telefono}</p>}
      <div className="chips"><Chip estado={selected.estadoCita} mapa={ESTADO_CITA} /><Chip estado={selected.estadoPago} mapa={ESTADO_PAGO} /></div>
      <dl className="resumen"><dt>Origen</dt><dd>{selected.origen}</dd><dt>Anticipo</dt><dd>{mxn(selected.anticipo)}</dd></dl>
      <h3>Línea de tiempo</h3>
      <ol className="lista history-timeline">
        {selected.events.map((event, index) => <li key={index} className="fila-lista estatica">
          <div><strong>{event.label}</strong>{event.note && <small>{event.note}</small>}</div>
          {event.at ? <time className="muted pequeño" dateTime={event.at}>{historyDate.format(new Date(event.at))}</time>
            : <small className="muted">Sin hora registrada</small>}
        </li>)}
      </ol>
    </PanelLateral>}
  </>;
}

function Detalle({ cita, paciente, dia, slot, cerrar }) {
  const saldo = consultorio.precioServicio - cita.anticipo;
  const c = cita.estadoCita;
  return (
    <PanelLateral cerrar={cerrar}>
        <p className="sub">{fechaLarga(dia)} · {slot?.inicio}–{slot?.fin}</p>
        <h2>{paciente.nombre}</h2>
        <p className="muted">📱 {paciente.telefono}</p>
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
              </p>
            <p className="muted">La cita se confirma sola cuando pey avisa que el pago llegó.</p>
          </div>
        )}
        {c === 'propuesta' && (
          <div className="caja"><strong>Esperando respuesta</strong><p>El paciente puede aceptar, rechazar o pedir otro horario desde WhatsApp. Al aceptar recibe la solicitud de pago.</p></div>
        )}

        <div className="acciones-col">
          {c === 'confirmada' && <>
            <button className="btn primario grande" disabled>Cobrar saldo de {mxn(saldo)} con CoDi · Próximamente</button>
            <div className="fila">
              <button className="btn secundario" disabled>Llegó · Próximamente</button>
              <button className="btn secundario" disabled>No asistió · Próximamente</button>
            </div>
          </>}
          {['pendiente_pago', 'confirmada'].includes(c) && <>
            <button className="btn secundario" disabled>Proponer otro horario · Próximamente</button>
            <button className="btn peligro" disabled>Cancelar cita · Próximamente</button>
          </>}
        </div>
    </PanelLateral>
  );
}

function ModalCobroProcedimiento({ cerrar, enviado }) {
  const [phone, setPhone] = useState('');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('0.01');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const parsedAmount = amount.trim().replace(',', '.');
  const amountCents = Math.round(Number(parsedAmount) * 100);
  const ready = phone.trim() && concept.trim() && key.trim() && /^\d+(\.\d{1,2})?$/.test(parsedAmount)
    && amountCents >= 1 && amountCents <= 100000000;

  async function send(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/panel/office-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
        body: JSON.stringify({ phone, concept, amountCents }),
      });
      const result = await response.json();
      if (response.ok) enviado(result.maskedPhone);
      else setError({
        unauthorized: 'La clave del consultorio no coincide.',
        invalid_request: 'Revisa el número mexicano, el concepto y el importe.',
        contact_window_closed: 'Pide al paciente que escriba al WhatsApp del consultorio antes de enviar el cobro.',
      }[result.error] || 'No pudimos confirmar el envío. Revisa el chat antes de repetirlo.');
    } catch {
      setError('No pudimos confirmar el envío. Revisa el chat antes de repetirlo.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="capa" onClick={busy ? undefined : cerrar}>
    <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
      <button type="button" className="cerrar" aria-label="Cerrar" disabled={busy} onClick={cerrar}>×</button>
      <h2>Cobrar por WhatsApp</h2>
      <label>WhatsApp del paciente (+52)<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 1234 5678" /></label>
      <label>Servicio o concepto<input maxLength={80} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Limpieza dental" /></label>
      <label>Monto en MXN<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label>Clave del consultorio<input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} /></label>
      <p className="muted pequeño">El paciente recibirá el concepto, el total y un botón para pagar con CoDi.</p>
      {error && <p role="alert">{error}</p>}
      <button className="btn primario grande" disabled={!ready || busy}>{busy ? 'Enviando…' : 'Enviar cobro por WhatsApp'}</button>
    </form>
  </div>;
}

function Cobros({ citas, paciente, dias, abrirCita, nuevo }) {
  const [filtro, setFiltro] = useState('pagados');
  const [independientes, setIndependientes] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function cargar() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const response = await fetch('/api/panel/office-charges', { cache: 'no-store', signal: controller.signal });
        if (response.ok && !controller.signal.aborted) setIndependientes((await response.json()).charges);
      } catch { /* Keep the last loaded list. */ }
      finally { busy = false; }
    }
    cargar();
    const timer = setInterval(cargar, 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  const filas = [
    ...citas.filter((c) => c.estadoPago !== 'sin_anticipo').map((c) => ({
      id: c.id, citaId: c.id, nombre: paciente(c.pacienteId).nombre,
      concepto: `Anticipo · ${fechaCorta(dias[c.dia])} ${slotsDelDia(dias[c.dia])[c.slot]?.inicio}`,
      monto: c.anticipo, estado: c.estadoPago,
    })),
    ...independientes.map((charge) => ({
      id: charge.id, nombre: 'Cobro por procedimiento',
      concepto: historyDate.format(new Date(charge.created_at)),
      monto: charge.amount_cents / 100, estado: charge.paid_at ? 'pagado' : 'pendiente',
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

function Pacientes({ pacientes, citas }) {
  const [q, setQ] = useState('');
  const digitos = q.replace(/\D/g, '');
  const lista = pacientes.filter((p) => !q || (digitos && p.telefono.includes(digitos)) || p.nombre.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <header className="encabezado"><div><h1>Pacientes</h1><p className="sub">{pacientes.length} registrados</p></div></header>
      <input className="buscador" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por teléfono o nombre" />
      <ul className="lista">
        {lista.length === 0 && <li className="vacio">Nada por aquí.</li>}
        {lista.map((p) => {
          const susCitas = citas.filter((c) => c.pacienteId === p.id);
          const pagado = susCitas.filter((c) => c.estadoPago === 'pagado').reduce((s, c) => s + c.anticipo, 0);
          return (
            <li key={p.id} className="fila-lista estatica">
              <div><strong>{p.nombre}</strong><small>{p.telefono} · {susCitas.length} citas · {mxn(pagado)} pagado</small></div>
              <div className="derecha fila">
                <button className="btn secundario chico" disabled>Agendar · Próximamente</button>
                <button className="btn secundario chico" disabled>Cobrar · Próximamente</button>
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
        <button className="btn secundario chico" disabled>Agregar bloqueo · Próximamente</button>
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
