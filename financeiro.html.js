const CSV_PAGAR_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUhYAMLxTCQCda-UC3miYvm6FnslYgxozIcC0532lU_Jwt2Xp7OnOJkjdvh2r3gyaKj7l2zm965_g4/pub?gid=0&single=true&output=csv';

let graficoDespesasPizza = null;
let dadosFinanceirosGlobais = [];

function parseValorBR(valorTexto) {
  if (!valorTexto) return 0;
  if (typeof valorTexto === 'number') return valorTexto;
  const limpo = valorTexto.toString().replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(limpo) || 0;
}

function parseDataBR(dataTexto) {
  if (!dataTexto) return null;
  let texto = dataTexto.toString().trim();
  
  if (texto.includes('-')) {
    const partesData = texto.split(' ')[0].split('-');
    if (partesData.length === 3) {
      return new Date(parseInt(partesData[0], 10), parseInt(partesData[1], 10) - 1, parseInt(partesData[2], 10), 12, 0, 0);
    }
  }
  
  const partes = texto.split('/');
  if (partes.length === 3) {
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const ano = parseInt(partes[2], 10);
    return new Date(ano, mes, dia, 12, 0, 0);
  }
  
  return null;
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.addEventListener('DOMContentLoaded', () => {
  const inputInicio = document.getElementById('filtro-data-inicio');
  const inputFim = document.getElementById('filtro-data-fim');
  
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const formatarDataInput = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  if (inputInicio && !inputInicio.value) inputInicio.value = formatarDataInput(primeiroDia);
  if (inputFim && !inputFim.value) inputFim.value = formatarDataInput(ultimoDia);

  carregarDashboardFinanceiro();
});

function carregarDashboardFinanceiro() {
  const inputInicio = document.getElementById('filtro-data-inicio');
  const inputFim = document.getElementById('filtro-data-fim');

  let dataInicio = new Date();
  let dataFim = new Date();

  if (inputInicio && inputInicio.value) {
    const [a, m, d] = inputInicio.value.split('-');
    dataInicio = new Date(parseInt(a, 10), parseInt(m, 10) - 1, parseInt(d, 10), 0, 0, 0);
  }

  if (inputFim && inputFim.value) {
    const [a, m, d] = inputFim.value.split('-');
    dataFim = new Date(parseInt(a, 10), parseInt(m, 10) - 1, parseInt(d, 10), 23, 59, 59);
  }

  const tituloTabela = document.getElementById('titulo-tabela-pagar');
  if (tituloTabela) {
    tituloTabela.innerText = `Contas a Pagar de ${dataInicio.toLocaleDateString('pt-BR')} até ${dataFim.toLocaleDateString('pt-BR')}`;
  }

  Papa.parse(CSV_PAGAR_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const dados = results.data;
      if (!dados || dados.length === 0) return;

      dadosFinanceirosGlobais = dados;
      processarContasPagar(dados, dataInicio, dataFim, null);
    }
  });
}

function processarContasPagar(dados, dataInicio, dataFim, filtroCategoria) {
  let totalPagarPeriodo = 0;
  let totalPagoPeriodo = 0;
  let totalAtrasadoPagar = 0;

  const tbodyPagar = document.getElementById('tb-pagar');
  if (tbodyPagar) tbodyPagar.innerHTML = '';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let linhasParaExibir = [];
  let despesasPorCategoria = {};

  dados.forEach(item => {
    const chaves = Object.keys(item);
    const getColuna = (nome) => {
      const chave = chaves.find(k => k.trim().toLowerCase() === nome.toLowerCase());
      return chave ? item[chave] : '';
    };

    const fornecedor = getColuna('Fornecedor (Nome Fantasia)') || getColuna('Fornecedor') || 'Fornecedor Não Identificado';
    const vencimentoTexto = getColuna('Vencimento');
    const pagamentoTexto = getColuna('Último Pagamento');
    const status = getColuna('Situação') || getColuna('Status') || '';
    const categoria = getColuna('Categoria') || 'Despesas Gerais';
    const documento = getColuna('Nota Fiscal') || getColuna('Número do Documento') || '-';

    const valorOriginal = parseValorBR(getColuna('Valor da Conta'));
    const valorPago = parseValorBR(getColuna('Valor Pago'));
    
    const dataVencimento = parseDataBR(vencimentoTexto);
    const dataPagamento = parseDataBR(pagamentoTexto);

    if (!dataVencimento) return;

    const vencimentoNoPeriodo = dataVencimento >= dataInicio && dataVencimento <= dataFim;
    const pagoNoPeriodo = dataPagamento && (dataPagamento >= dataInicio && dataPagamento <= dataFim);
    const statusLower = status.toLowerCase();
    const jaFoiPago = (statusLower.includes('pago') || statusLower.includes('liquidado') || dataPagamento !== null);

    if (vencimentoNoPeriodo && !jaFoiPago) {
      if (statusLower.includes('atrasado') || dataVencimento < hoje) {
        totalAtrasadoPagar += valorOriginal;
      } else {
        totalPagarPeriodo += valorOriginal;
      }
    }

    if (pagoNoPeriodo) {
      const valorEfetivo = valorPago > 0 ? valorPago : valorOriginal;
      totalPagoPeriodo += valorEfetivo;
    }

    let categoriaLinha = null;
    let valorExibicao = valorOriginal;

    if (pagoNoPeriodo) {
      categoriaLinha = 'Pago';
      valorExibicao = valorPago > 0 ? valorPago : valorOriginal;
    } else if (vencimentoNoPeriodo && !jaFoiPago) {
      if (statusLower.includes('atrasado') || dataVencimento < hoje) {
        categoriaLinha = 'Atrasados';
      } else {
        categoriaLinha = 'A Pagar';
      }
    }

    if (vencimentoNoPeriodo || pagoNoPeriodo) {
      despesasPorCategoria[categoria] = (despesasPorCategoria[categoria] || 0) + valorExibicao;

      let incluir = true;
      if (filtroCategoria) {
        incluir = (categoria === filtroCategoria);
      }

      if (incluir && categoriaLinha) {
        let tag = '';
        if (categoriaLinha === 'Pago') tag = '<span style="color: #2ecc71; font-weight: bold;">(Pago)</span>';
        else if (categoriaLinha === 'Atrasados') tag = '<span style="color: #e74c3c; font-weight: bold;">(Atrasado)</span>';
        else tag = '<span style="color: #3498db; font-weight: bold;">(A Pagar)</span>';

        linhasParaExibir.push({
          html: `
            <tr>
              <td><strong>${fornecedor}</strong> ${tag}</td>
              <td>${categoria}</td>
              <td>${vencimentoTexto.split(' ')[0]}</td>
              <td><span style="color: #A0A0A0;">${documento}</span></td>
              <td>${formatarMoeda(valorExibicao)}</td>
            </tr>`,
          valorSoma: valorExibicao
        });
      }
    }
  });

  let somaTabela = 0;
  linhasParaExibir.forEach(l => {
    if (tbodyPagar) tbodyPagar.innerHTML += l.html;
    somaTabela += l.valorSoma;
  });

  if (tbodyPagar) {
    if (linhasParaExibir.length > 0) {
      const tituloRodape = filtroCategoria ? `Total (${filtroCategoria}):` : 'Total do Período:';
      tbodyPagar.innerHTML += `
        <tr style="background-color: #252525; font-weight: bold; border-top: 2px solid #E85D17;">
          <td colspan="4" style="text-align: right; color: #FFFFFF;">${tituloRodape}</td>
          <td style="color: #E85D17;">${formatarMoeda(somaTabela)}</td>
        </tr>`;
    } else {
      tbodyPagar.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #A0A0A0;">Nenhuma conta encontrada neste período.</td></tr>`;
    }
  }

  document.getElementById('kpi-total-pagar').innerText = formatarMoeda(totalPagarPeriodo);
  document.getElementById('kpi-total-pago').innerText = formatarMoeda(totalPagoPeriodo);
  document.getElementById('kpi-total-atrasado-pagar').innerText = formatarMoeda(totalAtrasadoPagar);

  if (!filtroCategoria) {
    renderizarGraficoDespesas(despesasPorCategoria, dataInicio, dataFim);
  }
}

function renderizarGraficoDespesas(categoriasObj, dataInicio, dataFim) {
  const ctx = document.getElementById('graficoDespesasPizza').getContext('2d');
  if (graficoDespesasPizza) graficoDespesasPizza.destroy();

  const labels = Object.keys(categoriasObj);
  const valores = Object.values(categoriasObj);
  const cores = ['#E85D17', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71'];

  graficoDespesasPizza = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: cores.slice(0, labels.length),
        borderColor: '#1A1A1A',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const categoriaSelecionada = labels[index];
          document.getElementById('titulo-tabela-pagar').innerText = `Categoria: ${categoriaSelecionada}`;
          processarContasPagar(dadosFinanceirosGlobais, dataInicio, dataFim, categoriaSelecionada);
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#FFFFFF' } },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${formatarMoeda(context.raw)}`;
            }
          }
        }
      }
    }
  });
}