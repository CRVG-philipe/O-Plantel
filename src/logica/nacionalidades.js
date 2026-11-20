// Nacionalidade (como vem do Transfermarkt, em português) → código do país (ISO 3166, minúsculo).
// Usado para mostrar a bandeira ao lado do nome do jogador: public/img/flags/paises/<código>.svg
// (bandeiras do pacote flag-icons, licença MIT). Inglaterra, Escócia, Gales e Irlanda do Norte têm códigos "gb-...".
const CODIGO = {
  "Afeganistão": "af", "Albânia": "al", "Alemanha": "de", "Andorra": "ad", "Angola": "ao", "Argentina": "ar", "Argélia": "dz",
  "Arménia": "am", "Arábia Saudita": "sa", "Austrália": "au", "Azerbaijão": "az", "Bangladeche": "bd", "Barbados": "bb",
  "Benim": "bj", "Bielorrússia": "by", "Bolívia": "bo", "Brasil": "br", "Bulgária": "bg", "Burkina Faso": "bf", "Burundi": "bi",
  "Bélgica": "be", "Bósnia-Herzegovina": "ba", "Cabo Verde": "cv", "Camarões": "cm", "Canadá": "ca", "Cazaquistão": "kz",
  "Chade": "td", "Chile": "cl", "China": "cn", "Chipre": "cy", "Colômbia": "co", "Comores": "km", "Congo": "cg",
  "Coreia do Sul": "kr", "Costa Rica": "cr", "Costa do Marfim": "ci", "Croácia": "hr", "Curacao": "cw", "Dinamarca": "dk",
  "Egito": "eg", "El Salvador": "sv", "Emirados Árabes Unidos": "ae", "Equador": "ec", "Escócia": "gb-sct", "Eslováquia": "sk",
  "Eslovénia": "si", "Espanha": "es", "Estados Unidos": "us", "Estónia": "ee", "Filipinas": "ph", "Finlândia": "fi",
  "França": "fr", "Gabão": "ga", "Gana": "gh", "Geórgia": "ge", "Granada": "gd", "Grécia": "gr", "Guadalupe": "gp",
  "Guatemala": "gt", "Guiana": "gy", "Guiana Francesa": "gf", "Guiné": "gn", "Guiné Bissau": "gw", "Guiné Equatorial": "gq",
  "Gâmbia": "gm", "Haiti": "ht", "Holanda": "nl", "Honduras": "hn", "Hungria": "hu", "Ilhas Faroe": "fo", "Indonésia": "id",
  "Inglaterra": "gb-eng", "Iraque": "iq", "Irlanda": "ie", "Irlanda do Norte": "gb-nir", "Irão": "ir", "Islândia": "is",
  "Israel": "il", "Itália": "it", "Jamaica": "jm", "Japão": "jp", "Jordânia": "jo", "Kosovo": "xk", "Letónia": "lv",
  "Libéria": "lr", "Liechtenstein": "li", "Lituânia": "lt", "Luxemburgo": "lu", "Líbano": "lb", "Líbia": "ly",
  "Macedónia do Norte": "mk", "Madagascar": "mg", "Malawi": "mw", "Mali": "ml", "Malta": "mt", "Malásia": "my",
  "Marrocos": "ma", "Martinica": "mq", "Mauritânia": "mr", "Moldávia": "md", "Montenegro": "me", "Moçambique": "mz",
  "México": "mx", "Namíbia": "na", "Neocaledónia": "nc", "Nigéria": "ng", "Noruega": "no", "Nova Zelândia": "nz",
  "Níger": "ne", "Palestina": "ps", "Panamá": "pa", "Paraguai": "py", "País de Gales": "gb-wls", "Perú": "pe",
  "Polónia": "pl", "Porto Rico": "pr", "Portugal": "pt", "Qatar": "qa", "Quénia": "ke", "RD do Congo": "cd",
  "República Central Africana": "cf", "República Checa": "cz", "República Dominicana": "do", "Roménia": "ro", "Ruanda": "rw",
  "Rússia": "ru", "Santa Lúcia": "lc", "Senegal": "sn", "Serra Leoa": "sl", "Singapura": "sg", "Somália": "so",
  "Suiça": "ch", "Suriname": "sr", "Suécia": "se", "São Cristovão e Nevis": "kn", "São Vicente e Granadinas": "vc",
  "Sérvia": "rs", "Síria": "sy", "Tailândia": "th", "Tanzânia": "tz", "Togo": "tg", "Trinidad e Tobago": "tt",
  "Tunísia": "tn", "Turquia": "tr", "Ucrânia": "ua", "Uganda": "ug", "Uruguai": "uy", "Uzbequistão": "uz",
  "Venezuela": "ve", "Zimbabué": "zw", "Zâmbia": "zm", "África do Sul": "za", "Áustria": "at",
};

export const codigoDoPais = (nat) => CODIGO[nat] || null;
export const TODOS_OS_CODIGOS = Object.values(CODIGO);
