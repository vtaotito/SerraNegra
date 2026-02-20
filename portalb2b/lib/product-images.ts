const TCDN_BASE = "https://images.tcdn.com.br/img/img_prod/1123510";

const IMAGE_CATALOG: Record<string, string> = {
  "diamantina 200": `${TCDN_BASE}/180_diamantina_200ml_51_1_45decf039b05a35747b1b6c7d12d4910.jpg`,
  "cachaca do brasil 700": `${TCDN_BASE}/180_cachaca_do_brasil_700_ml_193_1_6a2b07a7e024391c3feea4847db29b83.jpg`,
  "belem 240": `${TCDN_BASE}/180_pote_belem_240_ml_caixa_com_24_unidades_41_1_52d3770c8a252c5d98048be7c5aa4663.jpg`,
  "conserva 600": `${TCDN_BASE}/180_pote_600_ml_caixa_com_15_unidades_445_1_29f0323bd0e3a515369a76c4f8e7ec5b.jpg`,
  "andino 360": `${TCDN_BASE}/180_andino_360_ml_47_1_c398b8c802a8b1119f7ffee393721ccd.jpg`,
  "paraiba 700": `${TCDN_BASE}/180_garrafa_paraiba_700_ml_fardo_com_15_unidades_471_1_e03cbb5797f757fafa9b391a77041df4.png`,
  "pate 156": `${TCDN_BASE}/180_copo_pate_156_ml_caixa_com_24_unidades_487_1_ab52351739d5687165bdc54edbd8c78f.jpg`,
  "azeite 500": `${TCDN_BASE}/180_garrafa_azeite_500_ml_com_24_unidades_409_1_914a7d90cad2e466dda6e0c97ab019d1.jpg`,
  "kappa 750": `${TCDN_BASE}/180_garrafa_kappa_750_ml_caixa_com_30_unidades_1_20251126103137_9ed96b947be5.jpeg`,
  "khloe 750": `${TCDN_BASE}/180_garrafa_khloe_750_ml_rolha_fardo_com_20_unidades_1_20251125165559_f62c92a1936a.jpeg`,
  "epsilon 750": `${TCDN_BASE}/180_munich_750_ml_133_3_a90d9676c940f86837d5b975d30427e7.jpg`,
  "euro 500": `${TCDN_BASE}/180_euro_500_ml_123_1_e119d341fff42e36183c1e0269dc95b3.jpg`,
  "quimio 1100": `${TCDN_BASE}/180_quimio_1100_ml_109_1_f10036c1ec979a6b9f9be0842af4a31e.jpg`,
  "tiradentes 700": `${TCDN_BASE}/180_garrafa_tiradentes_700ml_fardo_com_24_unidades_545_1_f8897dcd2eac938c6d362efeece4f0d2.jpg`,
  "suco 300": `${TCDN_BASE}/180_garrafa_suco_300_ml_caixa_com_24_unidades_177_1_c7ee882a1adfd5d115fceccd68ee6b0b.jpg`,
  "levedura": `${TCDN_BASE}/180_levedura_para_cachaca_75_1_c446b2e2a1cfbdf91b9c357b6201d066.jpg`,
  "molho pimenta": `${TCDN_BASE}/180_pote_mini_molho_pimenta_60_ml_caixa_com_90_unidades_17_1_c5b690d65a4ab2181e6d5b98282de670.jpg`,
  "tampa metalica 74": `${TCDN_BASE}/180_tampa_metlica_74_mm_caixa_c15_unidades_1_20251128170104_b1472ce868c1.jpeg`,
  "lacre 29": `${TCDN_BASE}/180_lacre_termoencolhvel_29mm_garrafas_pct_c_50_1_20260102175405_7e7a83a3fee7.png`,
  "erlenmeyer 500": `${TCDN_BASE}/180_frasco_erlenmeyer_500_ml_vidro_383_1_3bb9c004ab32e8bb5a8ac86bfc07e213.jpg`,
  "cachaca 500": `${TCDN_BASE}/180_cachaca_do_brasil_700_ml_193_1_6a2b07a7e024391c3feea4847db29b83.jpg`,
  "oval 750": `${TCDN_BASE}/180_munich_750_ml_133_1_a01232ab948cdbac975a14edd717b99f.jpg`,
  "azeite 250": `${TCDN_BASE}/180_garrafa_azeite_500_ml_com_24_unidades_409_1_914a7d90cad2e466dda6e0c97ab019d1.jpg`,
  "mini litro": `${TCDN_BASE}/180_diamantina_200ml_51_1_45decf039b05a35747b1b6c7d12d4910.jpg`,
};

const CATALOG_KEYS = Object.keys(IMAGE_CATALOG);

export function getProductImageUrl(productName: string): string | null {
  const normalized = productName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const key of CATALOG_KEYS) {
    if (normalized.includes(key)) {
      return IMAGE_CATALOG[key];
    }
  }

  return null;
}

export const GSN_LOGO_URL = `${TCDN_BASE}/1663874735_logogsnonline.png`;

export const PLACEHOLDER_PRODUCT_IMAGE = "/images/products/diamantina-200ml.jpg";

export const FEATURED_PRODUCTS = [
  {
    name: "Garrafa Diamantina 200ml",
    image: `${TCDN_BASE}/180_diamantina_200ml_51_1_45decf039b05a35747b1b6c7d12d4910.jpg`,
    price: "R$ 99,61",
    discount: 6,
  },
  {
    name: "Garrafa Cachaça do Brasil 700ml",
    image: `${TCDN_BASE}/180_cachaca_do_brasil_700_ml_193_1_6a2b07a7e024391c3feea4847db29b83.jpg`,
    price: "R$ 98,64",
    discount: 11,
  },
  {
    name: "Garrafa Euro 500ml",
    image: `${TCDN_BASE}/180_euro_500_ml_123_1_e119d341fff42e36183c1e0269dc95b3.jpg`,
    price: "R$ 80,16",
    discount: 3,
  },
  {
    name: "Garrafa Kappa 750ml",
    image: `${TCDN_BASE}/180_garrafa_kappa_750_ml_caixa_com_30_unidades_1_20251126103137_9ed96b947be5.jpeg`,
    price: "R$ 341,40",
  },
  {
    name: "Pote Belém 240ml",
    image: `${TCDN_BASE}/180_pote_belem_240_ml_caixa_com_24_unidades_41_1_52d3770c8a252c5d98048be7c5aa4663.jpg`,
    price: "R$ 41,04",
    discount: 6,
  },
  {
    name: "Garrafa Azeite 500ml",
    image: `${TCDN_BASE}/180_garrafa_azeite_500_ml_com_24_unidades_409_1_914a7d90cad2e466dda6e0c97ab019d1.jpg`,
    price: "R$ 78,00",
    discount: 16,
  },
];
