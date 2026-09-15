export type ImperiumCliente = {
  codCliente: string;
  nome: string;
  cpfCnpj: string;
  tipoPessoa: "F" | "J";
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento?: string;
  referencia?: string;
};

export type ImperiumProdutoPedido = {
  codProduto: string;
  grade: string;
  quantidade: number;
  valorVenda: number;
  lote?: string | null;
};

export type ImperiumPedido = {
  codPedido: string;
  tipo: string;
  linhaEntrega?: string;
  itinerarioId?: string;
  itinerarioNome?: string;
  cliente: ImperiumCliente;
  produtos: ImperiumProdutoPedido[];
  observacao?: string | null;
};

export type ImperiumCargaInput = {
  codCarga: string;
  placa: string;
  placaExpedicao?: string;
  pedidos: ImperiumPedido[];
};

export type ImperiumEmbalagem = {
  codBarras?: string;
  qtdEmbalagem: number;
  descricao: string;
  altura?: number;
  largura?: number;
  comprimento?: number;
  peso?: number;
  cubagem?: number;
};

export type ImperiumProdutoCadastro = {
  idProduto: string;
  descricao: string;
  grade: string;
  idFabricante: string;
  tipo: string;
  idClasse: string;
  referencia?: string;
  possuiPesoVariavel?: "S" | "N";
  embalagens?: ImperiumEmbalagem[];
};

export type ImperiumNotaSaida = {
  codPedido: string;
  numeroNf: number;
  serieNf: string;
  cnpjEmitente: string;
  valorVenda: number;
  chaveAcesso: string;
  itens: Array<{
    codProduto: string;
    grade: string;
    qtd: number;
    valorVenda: number;
  }>;
};

export type ImperiumFornecedor = {
  idFornecedor: string;
  nome: string;
  cnpj?: string;
  insc?: string;
  cpf?: string;
};

export type ImperiumNotaEntrada = {
  idFornecedor: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  placa?: string;
  bonificacao?: "S" | "N";
  observacao?: string;
  cnpjDestinatario?: string;
  itens: Array<{ idProduto: string; grade?: string; quantidade: number }>;
};

export type ImperiumFiltroProduto = {
  codProduto: string;
  grade?: string;
};

export type ImperiumEstoquePosicao = {
  codProduto: string;
  grade: string;
  estoqueArmazenado: number;
  estoqueDisponivel: number;
  areaArmazenagem: string;
};

export type ImperiumMovimentacao = {
  ponteiro: string;
  dthMovimentacao: string;
  codProduto: string;
  grade: string;
  motivo: string;
  quantidade: number;
  tipo: string;
  idAreaOrigem: string;
  areaOrigem: string;
  idAreaDestino: string;
  areaDestino: string;
};

export type ImperiumSoapResult = {
  ok: boolean;
  statusCode: number;
  method: string;
  service: string;
  durationMs: number;
  booleanReturn: boolean | null;
  fault: string | null;
  bodyXml: string;
};
