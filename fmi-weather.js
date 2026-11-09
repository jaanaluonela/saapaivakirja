/* Ilmatieteen laitoksen avoin WFS: tuntiennuste ja lähimmän aseman havainnot. */
(function () {
  const endpoint = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=';
  const child = (node, name) => Array.from(node.getElementsByTagName('*')).find(el => el.localName === name);
  const children = (node, name) => Array.from(node.getElementsByTagName('*')).filter(el => el.localName === name);
  const finite = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };

  function parse(xml, kind) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length || children(doc, 'ExceptionReport').length) throw Error('Ilmatieteen laitoksen vastausta ei voitu lukea');
    const positions = child(doc, 'positions');
    const values = child(doc, 'doubleOrNilReasonTupleList');
    const fieldNodes = children(doc, 'field');
    if (!positions || !values || !fieldNodes.length) throw Error('Säätietojen muoto ei vastaa odotettua');
    const fields = fieldNodes.map(x => x.getAttribute('name'));
    const positionRows = positions.textContent.trim().split(/\n+/).map(line => line.trim().split(/\s+/));
    const valueRows = values.textContent.trim().split(/\n+/).map(line => line.trim().split(/\s+/));
    if (positionRows.length !== valueRows.length) throw Error('Säätietojen rivimäärät eivät täsmää');
    const rows = positionRows.map((p, i) => {
      if (p.length < 3 || valueRows[i].length !== fields.length) throw Error('Puutteellinen säätietorivi');
      const row = { time: finite(p[2]) * 1000 };
      fields.forEach((name, j) => { row[name] = finite(valueRows[i][j]); });
      return row;
    }).filter(row => Number.isFinite(row.time));
    const station = kind === 'observation' ? (child(doc, 'name')?.textContent.trim() || 'lähin havaintoasema') : '';
    return { rows, station };
  }

  async function request(query, city, kind) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint + encodeURIComponent(query) + '&place=' + encodeURIComponent(city), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw Error('Ilmatieteen laitoksen palvelu ei vastaa');
      return parse(await response.text(), kind);
    } finally { clearTimeout(timeout); }
  }

  async function load(city) {
    const [forecast, observation] = await Promise.allSettled([
      request('fmi::forecast::harmonie::surface::point::multipointcoverage', city, 'forecast'),
      request('fmi::observations::weather::multipointcoverage', city, 'observation')
    ]);
    return {
      forecast: forecast.status === 'fulfilled' ? forecast.value : null,
      observation: observation.status === 'fulfilled' ? observation.value : null
    };
  }

  window.FMIWeather = { load };
})();
