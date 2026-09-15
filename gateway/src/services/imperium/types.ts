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

export type ImperiumProdutoCadastro = {
  idProduto: string;
  descricao: string;
  grade: string;
  idFabricante: string;
  tipo: string;
  idClasse: string;
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
