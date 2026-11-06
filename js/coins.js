/* ============================================================
   AUREUM — coin collection
   ------------------------------------------------------------
   Add a coin by copying one object below. The carousel, dots,
   counter, keyboard shortcuts and colours adapt automatically.

   Required: id, name, metal, purity, desc, price, weight,
             mintage, diameter, accent, accentSoft, base, rim,
             emblem

   Optional: frontImage / backImage — paths to square photos
             (e.g. "assets/coins/my-coin.png"). When supplied the
             engraved face is replaced by the photo and a relief
             normal map is derived from it.
   ============================================================ */
window.AUREUM_COINS = [
  {
    id: 'solaris',
    name: 'Solaris',
    metal: '24 Karat Gold',
    purity: '999.9 ‰',
    year: 'MMXXVI',
    desc: 'A single troy ounce of 24-karat gold beneath a hand-cut guilloché sunburst.',
    price: '$4,280',
    weight: '31.10 g',
    mintage: '250',
    diameter: '38.6 mm',
    accent: '#e8b45a',
    accentSoft: '#f8e5b4',
    base: [240, 182, 80],
    rim: 0xf2cd86,
    edge: 0xd9ae66,
    patina: false,
    iridescence: 0,
    emblem: 'sun',
    legendTop: 'SOLARIS',
    legendBottom: 'AUREUM · MMXXVI',
    serial: 'N° 001 — 250',
    halo: 0.5
  },
  {
    id: 'selene',
    name: 'Selene',
    metal: 'Sterling Silver',
    purity: '999.0 ‰',
    year: 'MMXXVI',
    desc: 'Cold-struck silver with a crescent moon in high relief and seven scattered stars.',
    price: '$1,140',
    weight: '31.10 g',
    mintage: '500',
    diameter: '38.6 mm',
    accent: '#ccd8e6',
    accentSoft: '#eef4fb',
    base: [212, 221, 235],
    rim: 0xe8eef8,
    edge: 0xc6d0dd,
    patina: false,
    iridescence: 0,
    emblem: 'moon',
    legendTop: 'SELENE',
    legendBottom: 'AUREUM · MMXXVI',
    serial: 'N° 001 — 500',
    halo: 0.34
  },
  {
    id: 'verdant',
    name: 'Verdant',
    metal: 'Patina Bronze',
    purity: 'CuZn · OX',
    year: 'MMXXVI',
    desc: 'Cast bronze aged for nine weeks until the surface breaks into a living green patina.',
    price: '$690',
    weight: '28.40 g',
    mintage: '750',
    diameter: '39.2 mm',
    accent: '#8dbfa4',
    accentSoft: '#d3eddd',
    base: [156, 192, 154],
    rim: 0xa9c8ad,
    edge: 0x91a88a,
    patina: true,
    iridescence: 0,
    emblem: 'leaf',
    legendTop: 'VERDANT',
    legendBottom: 'AUREUM · MMXXVI',
    serial: 'N° 001 — 750',
    halo: 0.4
  },
  {
    id: 'nova',
    name: 'Nova',
    metal: 'Rose Gold',
    purity: '750.0 ‰',
    year: 'MMXXVI',
    desc: 'An eighteen-karat rose gold disc, struck once and never polished again.',
    price: '$2,450',
    weight: '31.10 g',
    mintage: '300',
    diameter: '38.6 mm',
    accent: '#e5a189',
    accentSoft: '#fbd8ca',
    base: [242, 188, 162],
    rim: 0xf0c3b0,
    edge: 0xd9a48f,
    patina: false,
    iridescence: 0,
    emblem: 'star',
    legendTop: 'NOVA',
    legendBottom: 'AUREUM · MMXXVI',
    serial: 'N° 001 — 300',
    halo: 0.42
  },
  {
    id: 'erebus',
    name: 'Erebus',
    metal: 'Black Titanium',
    purity: 'Ti · Gr.5',
    year: 'MMXXVI',
    desc: 'Grade-five titanium, anodised in near-black with an eclipse cut into its face.',
    price: '$980',
    weight: '24.00 g',
    mintage: '400',
    diameter: '40.0 mm',
    accent: '#9aa3d4',
    accentSoft: '#d3d8f4',
    base: [132, 140, 174],
    rim: 0xa9b2d8,
    edge: 0x7d86ab,
    patina: false,
    iridescence: 1,
    emblem: 'eclipse',
    legendTop: 'EREBUS',
    legendBottom: 'AUREUM · MMXXVI',
    serial: 'N° 001 — 400',
    halo: 0.46
  }

  /* ---- TEMPLATE — uncomment, rename and place it above ----

  , {
    id: 'aurora',
    name: 'Aurora',
    metal: 'Platinum',
    purity: '950.0 ‰',
    year: 'MMXXVI',
    desc: 'A cold platinum disc with a hand-polished field.',
    price: '$3,100',
    weight: '31.10 g',
    mintage: '200',
    diameter: '38.6 mm',
    accent: '#b9c8d8',
    accentSoft: '#e6eef8',
    base: [200, 210, 222],
    rim: 0xdbe4ee,
    emblem: 'star',            // sun | moon | leaf | star | eclipse
    legendTop: 'AURORA',
    legendBottom: 'AUREUM · MMXXVI',
    serial: 'N° 001 — 200',
    halo: 0.36,

    // optional photo faces (square, coin centred, fills the frame)
    // frontImage: 'assets/coins/aurora-front.png',
    // backImage: 'assets/coins/aurora-back.png',
    // imageRelief: 0.8
  }

  ---------------------------------------------------------- */
];
