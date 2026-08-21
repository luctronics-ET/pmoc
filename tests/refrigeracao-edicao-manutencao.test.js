const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'refrigeracao', 'index.html'), 'utf8');
const plano = (valor) => JSON.parse(JSON.stringify(valor));

function carregarHelpers() {
  const ini = HTML.indexOf('function normalizarTextoCampo');
  const fim = HTML.indexOf('/* ── Persistência → delegada para camada Supabase');
  assert.ok(ini > 0 && fim > ini, 'helpers de edição/medições não encontrados');
  const ctx = { esc: (v) => String(v == null ? '' : v) };
  vm.createContext(ctx);
  vm.runInContext(HTML.slice(ini, fim), ctx);
  return ctx;
}

test('montarPatchEquipamento normaliza texto, números e o flag de criticidade manual', () => {
  const ctx = carregarHelpers();
  const patch = ctx.montarPatchEquipamento({
    area: ' Azul ',
    predio: '  F21',
    local: 'Sala 1 ',
    tipo: 'SPLIT',
    fabricante: '',
    modelo: 'Hi Wall',
    btu: '12000',
    funciona: 'OK',
    estado: 'SEMI',
    obs: ' revisado ',
    refrigPermanente: true,
    horasDia: '8',
    diasSemana: '5',
    criticidade: 'ALTA',
    criticidadeManual: true,
    tensao: '220',
    correnteNominal: '9,5',
    patrimonio: '123',
    dataInstalacao: '2026-08-19',
    ultimaManutencao: '',
    refrigerante: 'R410A',
    areaM2: '42,5',
    peDireito: '3.2',
    nPessoas: '6',
    dissipacaoW: '350',
    fatorInsolacao: '1.3'
  });
  assert.deepStrictEqual(plano(patch), {
    area: 'Azul',
    predio: 'F21',
    local: 'Sala 1',
    tipo: 'SPLIT',
    fabricante: null,
    modelo: 'Hi Wall',
    btu: 12000,
    funciona: 'OK',
    estado: 'SEMI',
    obs: 'revisado',
    refrig_permanente: true,
    horas_dia: 8,
    dias_semana: 5,
    criticidade: 'ALTA',
    criticidade_manual: true,
    tensao: 220,
    corrente_nominal: 9.5,
    patrimonio: '123',
    data_instalacao: '2026-08-19',
    ultima_manutencao: null,
    refrigerante: 'R410A',
    area_m2: 42.5,
    pe_direito: 3.2,
    n_pessoas: 6,
    dissipacao_w: 350,
    fator_insolacao: 1.3
  });
});

test('só preventiva/corretiva concluída atualiza o equipamento ao fechar a OS', () => {
  const ctx = carregarHelpers();
  const equip = { funciona: 'NOK', estado: 'VELHA', criticidade: 'CRÍTICA', ultimaManutencao: null };
  assert.equal(ctx.montarPatchConclusaoManutencao(equip, { tipo: 'INSPEÇÃO', status: 'CONCLUÍDA', date: '2026-08-19' }), null);
  assert.equal(ctx.montarPatchConclusaoManutencao(equip, { tipo: 'CORRETIVA', status: 'PENDENTE', date: '2026-08-19' }), null);
  assert.deepStrictEqual(
    plano(ctx.montarPatchConclusaoManutencao(equip, {
      tipo: 'CORRETIVA',
      status: 'CONCLUÍDA',
      date: '2026-08-19',
      funciona: 'OK',
      estado: 'SEMI',
      criticidade: 'ALTA',
      obs: 'Operando'
    })),
    {
      funciona: 'OK',
      estado: 'SEMI',
      criticidade: 'ALTA',
      criticidadeManual: true,
      obs: 'Operando',
      ultimaManutencao: '2026-08-19'
    }
  );
});

test('analisarMedicoes calcula ΔT e compara corrente/pressão com a referência', () => {
  const ctx = carregarHelpers();
  const analise = ctx.analisarMedicoes(
    { correnteNominal: 10, refrigerante: 'R410A' },
    { tempInsuflamento: '14', tempRetorno: '26', correnteMedida: '9.6', pressaoSuccao: '118' }
  );
  assert.equal(analise.deltaT, 12);
  assert.deepStrictEqual(
    plano(analise.itens.map((item) => ({ chave: item.chave, ok: item.ok, referencia: item.referencia }))),
    [
      { chave: 'delta_t', ok: true, referencia: '10–14 °C' },
      { chave: 'corrente', ok: true, referencia: '±10% de 10 A' },
      { chave: 'pressao', ok: true, referencia: '110–130 psi (R410A)' }
    ]
  );
});

test('o dashboard passou a ter host fixo para os gráficos e regra responsiva explícita', () => {
  assert.match(HTML, /<div id="dash-charts"><\/div>/);
  assert.match(HTML, /#dash-charts\{display:grid;grid-template-columns:1fr;gap:10px\}/);
  assert.match(HTML, /@media \(max-width: 420px\)\{[\s\S]*\.dfields2,\.fg2\{grid-template-columns:1fr\}/);
});
