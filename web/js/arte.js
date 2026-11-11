/* ==========================================================
   Arte de Alpaqori: ilustraciones de platos e íconos (SVG propio, sin emojis)
   - 12 ilustraciones estilo "grabado culinario peruano" (viewBox 0 0 120 120)
     .tr = trazo dorado que se dibuja al activar la tarjeta
     .ac = acento coral
     .vp = vapor · .bb = burbujas · g.fuego · g.hielo · g.gira · g.chispas = partes que se animan
   - Íconos de sección (viewBox 0 0 24 24, trazo)
   - para(producto): elige la ilustración según el nombre y la categoría
   ========================================================== */
window.ALPAQORI_ARTE = (function () {
  var VAPOR = '<g class="vapor"><path class="vp" d="M44 40q-6-8 0-16t0-16"/><path class="vp" d="M60 38q-6-8 0-16t0-16"/><path class="vp" d="M76 40q-6-8 0-16t0-16"/></g>';

  var ILUS = {
    // 1. Sartén / wok flameando: lomo, papas fritas, tomate y fuego criollo
    wok:
      '<ellipse class="tr" cx="56" cy="64" rx="38" ry="11"/>' +
      '<path class="tr" d="M18 64q2 22 38 24q36-2 38-24"/><path class="tr" d="M94 68l22-8"/>' +
      '<rect class="tr" x="36" y="54" width="11" height="8" rx="2" transform="rotate(-12 41 58)"/>' +
      '<rect class="tr" x="56" y="50" width="12" height="8" rx="2" transform="rotate(10 62 54)"/>' +
      '<rect class="tr" x="72" y="56" width="9" height="7" rx="2"/>' +
      '<path class="tr" d="M28 58l12-12M46 52l6-14M80 52l10-10"/>' +
      '<path class="ac" d="M52 62a6 6 0 0 1 12 0z"/><path class="ac" d="M30 50l6-2 2 5z"/>' +
      '<g class="fuego"><path class="ac" d="M36 112q-7-10 1-17q0 8 6 10q2-8 8-11q-2 10 2 18z"/>' +
      '<path class="ac" d="M60 114q-8-12 2-20q0 9 7 11q2-9 9-12q-3 12 2 21z"/>' +
      '<path class="ac" d="M84 112q-6-9 1-15q0 7 5 9q2-7 7-9q-2 9 1 15z"/></g>',

    // 2. Canasta: pan con chicharrón, camote, zarza criolla y tamal en hoja
    canasta:
      '<path class="tr" d="M14 62h92l-10 44H24z"/><path class="tr" d="M20 74h80M23 88h74M40 62l-6 44M60 62v44M80 62l6 44"/>' +
      '<path class="tr" d="M24 60q2-20 24-20t24 20"/><path class="ac" d="M34 52q7-7 14 0q-3 6-14 0zM50 50q6-5 12 0q-3 5-12 0z"/>' +
      '<path class="tr" d="M70 30l28 7-6 21-28-7z"/><path class="tr" d="M74 37l20 5M72 45l20 5"/>' +
      '<circle class="ac" cx="100" cy="58" r="6"/><circle class="tr" cx="100" cy="58" r="2.5"/>' +
      '<path class="ac" d="M22 44q6-5 11 1M30 37q6-3 9 3"/>',

    // 3. Olla de barro humeante con cucharón, choclo y hierbabuena
    olla:
      '<path class="tr" d="M22 56h76v8q0 32-38 34q-38-2-38-34z"/><ellipse class="tr" cx="60" cy="56" rx="40" ry="8"/>' +
      '<path class="tr" d="M20 62q-10 0-10 8t10 6M100 62q10 0 10 8t-10 6"/><path class="tr" d="M30 80q30 10 60 0M36 90q24 6 48 0"/>' +
      '<path class="tr" d="M78 52l22-34"/><ellipse class="tr" cx="102" cy="15" rx="7" ry="4" transform="rotate(-55 102 15)"/>' +
      '<path class="ac" d="M38 54q4-13 11-15q2 9-5 15z"/><path class="ac" d="M58 52q6-10 15-8q-4 8-15 8z"/>' + VAPOR,

    // 4. Fuente marina: pescado, camarón, cancha, ají limo y olas
    marina:
      '<ellipse class="tr" cx="60" cy="74" rx="48" ry="16"/><ellipse class="tr" cx="60" cy="72" rx="36" ry="10"/>' +
      '<path class="tr" d="M28 64q15-15 36 0q-21 13-36 0zM64 64l12-8v16z"/><circle class="tr" cx="36" cy="62" r="1.6"/>' +
      '<path class="ac" d="M78 70q10-15 23-4q-6 2-8 8q-6-4-15-4z"/><path class="ac" d="M70 82q8-2 12 4"/>' +
      '<circle class="tr" cx="48" cy="80" r="2"/><circle class="tr" cx="55" cy="83" r="2"/><circle class="tr" cx="62" cy="80" r="2"/>' +
      '<path class="tr" d="M8 104q8-6 16 0t16 0t16 0t16 0t16 0t16 0t16 0"/>' +
      '<path class="tr" d="M20 30q6-10 12 0t12 0"/><circle class="ac" cx="92" cy="30" r="7"/><path class="ac" d="M92 23v14M85 30h14"/>',

    // 5. Plato criollo: presa dorada, arroz, culantro, ají amarillo y rombos
    criollo:
      '<circle class="tr" cx="60" cy="64" r="44"/><circle class="tr" cx="60" cy="64" r="34"/>' +
      '<path class="ac" d="M60 18l3 4-3 4-3-4zM106 64l-4 3-4-3 4-3zM60 110l-3-4 3-4 3 4zM14 64l4-3 4 3-4 3z"/>' +
      '<path class="tr" d="M32 72q0-17 19-17t19 17z"/><path class="tr" d="M40 64h22M38 68h26"/>' +
      '<path class="tr" d="M66 58q10-13 23-5q6 9-4 17q-8 4-12-2l-6 6q-4 2-4-2l6-6q-6-2-3-8z"/>' +
      '<path class="ac" d="M40 50q-4-7 2-9q3 5-2 9zM47 48q0-7 7-7q0 6-7 7z"/><circle class="ac" cx="58" cy="85" r="5"/>',

    // 6. Brasero festivo: papas nativas, presa, ensalada criolla y chispas de brasa
    brasero:
      '<path class="tr" d="M18 58h84q-4 30-42 30T18 58z"/><path class="tr" d="M34 88l-8 22M86 88l8 22M60 88v22"/>' +
      '<path class="tr" d="M24 54h72M28 48h64"/>' +
      '<ellipse class="tr" cx="38" cy="42" rx="8" ry="6"/><ellipse class="tr" cx="55" cy="40" rx="7" ry="5"/>' +
      '<path class="ac" d="M68 44q8-13 19-6q4 9-6 13zM70 46l-6 4"/><path class="ac" d="M30 34q4-6 10-4M48 31q4-4 8 0"/>' +
      '<g class="chispas"><circle class="ac" cx="30" cy="20" r="2"/><circle class="ac" cx="62" cy="13" r="1.6"/><circle class="ac" cx="92" cy="24" r="2.2"/><circle class="ac" cx="78" cy="10" r="1.4"/></g>',

    // 7. Tazón de chaufa al wok con cebollita china, palitos y vapor
    chaufa:
      '<path class="tr" d="M16 62h88q-4 34-44 34T16 62z"/><path class="tr" d="M44 96h32"/>' +
      '<path class="tr" d="M24 62q6-22 36-22t36 22"/>' +
      '<circle class="tr" cx="40" cy="54" r="1.4"/><circle class="tr" cx="58" cy="48" r="1.4"/><circle class="tr" cx="76" cy="54" r="1.4"/><circle class="tr" cx="66" cy="56" r="1.4"/>' +
      '<circle class="ac" cx="50" cy="52" r="3"/><circle class="ac" cx="68" cy="47" r="3"/><circle class="ac" cx="80" cy="57" r="2.5"/>' +
      '<path class="tr" d="M82 32l30-22M88 36l28-18"/>' + VAPOR,

    // 8. Taza de cerámica con granos de café y vapor aromático
    cafe:
      '<path class="tr" d="M26 52h56v18q0 22-28 22T26 70z"/><path class="tr" d="M82 58h8q10 0 10 10t-10 10h-10"/>' +
      '<ellipse class="tr" cx="56" cy="100" rx="40" ry="7"/><ellipse class="tr" cx="54" cy="52" rx="28" ry="5"/>' +
      '<path class="ac" d="M36 66q18 6 36 0"/>' +
      '<ellipse class="ac" cx="18" cy="108" rx="5" ry="3.5" transform="rotate(-20 18 108)"/><ellipse class="ac" cx="100" cy="110" rx="5" ry="3.5" transform="rotate(25 100 110)"/>' + VAPOR,

    // 9. Jarra de chicha / limonada: hielos, fruta, menta y burbujas
    jarra:
      '<path class="tr" d="M34 20h44l-4 10v66q0 8-8 8H46q-8 0-8-8V30z"/><path class="tr" d="M74 40q20 0 20 18t-20 18"/>' +
      '<path class="ac" d="M40 50h32v44q0 6-6 6H46q-6 0-6-6z"/>' +
      '<g class="hielo"><rect class="tr" x="44" y="56" width="10" height="10" rx="2" transform="rotate(12 49 61)"/><rect class="tr" x="58" y="64" width="9" height="9" rx="2" transform="rotate(-10 62 68)"/></g>' +
      '<circle class="ac" cx="82" cy="22" r="9"/><path class="ac" d="M82 13v18M73 22h18"/>' +
      '<path class="tr" d="M26 18q6-9 15-4q-6 7-15 4z"/>' +
      '<g class="burbujas"><circle class="bb" cx="50" cy="90" r="2"/><circle class="bb" cx="60" cy="84" r="1.6"/><circle class="bb" cx="66" cy="92" r="2.2"/></g>',

    // 10. Chopp helado con espuma rebosante y trigo andino
    cerveza:
      '<path class="tr" d="M30 34h44v62q0 6-6 6H36q-6 0-6-6z"/><path class="tr" d="M74 46h8q10 0 10 10v14q0 10-10 10h-8"/>' +
      '<path class="tr" d="M40 50v40M52 50v40M64 50v40"/>' +
      '<path class="ac" d="M28 36q0-12 12-10q4-8 14-4q8-6 16 2q10 0 8 12z"/>' +
      '<g class="burbujas"><circle class="bb" cx="46" cy="84" r="2"/><circle class="bb" cx="58" cy="76" r="1.6"/><circle class="bb" cx="68" cy="88" r="1.8"/></g>' +
      '<path class="tr" d="M106 106V50"/><path class="ac" d="M106 58q-6-4-6-10q6 2 6 10zM106 58q6-4 6-10q-6 2-6 10zM106 70q-6-4-6-10q6 2 6 10zM106 70q6-4 6-10q-6 2-6 10z"/>',

    // 11. Copa de vino tinto que gira, con racimo de uvas
    vino:
      '<g class="gira"><path class="tr" d="M38 14h40q2 34-20 40q-22-6-20-40z"/><path class="ac" d="M40 30h36q-2 20-18 22q-16-2-18-22z"/></g>' +
      '<path class="tr" d="M58 54v40M42 100h32"/>' +
      '<circle class="tr" cx="92" cy="70" r="5"/><circle class="tr" cx="102" cy="70" r="5"/><circle class="tr" cx="97" cy="79" r="5"/>' +
      '<circle class="tr" cx="87" cy="79" r="5"/><circle class="tr" cx="92" cy="88" r="5"/><path class="tr" d="M97 65q2-8 8-10"/>',

    // 12. Pisco sour: copa con espuma, gotas de amargo, limón y coctelera
    coctel:
      '<path class="tr" d="M18 30h56q-4 26-28 28q-24-2-28-28z"/><path class="tr" d="M46 58v34M32 98h28"/>' +
      '<path class="ac" d="M20 34h52q-2 6-26 8q-24-2-26-8z"/><circle class="ac" cx="40" cy="37" r="1.8"/><circle class="ac" cx="50" cy="36" r="1.8"/>' +
      '<g class="gira"><circle class="tr" cx="76" cy="26" r="9"/><path class="tr" d="M76 17v18M67 26h18M70 20l12 12M82 20l-12 12"/></g>' +
      '<path class="tr" d="M90 62h18l-2 44H92z"/><path class="tr" d="M92 62q0-10 7-12q7 2 7 12M96 50v-6h6v6"/>' +
      '<g class="hielo"><rect class="tr" x="28" y="44" width="7" height="7" rx="1.5"/></g>'
  };

  // Reglas por nombre (en orden de prioridad). Se busca sin tildes ni mayúsculas.
  var REGLAS = [
    [/chaufa|chifa|chijaukay|chihaukay|amazonico/, "chaufa"],
    [/cafe|infusion/, "cafe"],
    [/pisco|sour|chilcano|coctel|algarrobina|daiquiri|mojito|martini/, "coctel"],   // antes que "maracuyá" (chilcano de maracuyá)
    [/vino|copa|sangria/, "vino"],
    [/cerveza|pilsen|cusquena|cumbres|corona/, "cerveza"],
    [/^jugo|chicha morada|limonada|maracuya|frozen/, "jarra"],   // "chicha morada": no confundir con chicharrón; "^jugo": el lomo al jugo es un plato
    [/lomo|saltado|bistec|churrasco|asado|huancalomo|^promo lomera/, "wok"],
    [/chicharron|tamal|campechano|desayuno/, "canasta"],
    [/sopa|patasca|shambar|achorado|menestron|caldo|dieta|sancochado/, "olla"],
    [/ceviche|marisco|trucha|causa|camaron|marino|leche de tigre/, "marina"],
    [/arroz con pato|seco|cabrito|norte[nñ][oa]|carapulcra|combinado|tallarin|ronda|siete colores|osobuco/, "criollo"],
    [/cuy|parrilla|chuleta|pollo|milanesa/, "brasero"]
  ];
  var POR_CATEGORIA = {
    "desayunos": "canasta", "entradas": "criollo", "sopas": "olla", "platos-de-fondo": "criollo",
    "platos-fin-de-semana": "criollo", "promociones": "canasta", "guarniciones": "criollo",
    "jugos-bebidas-calientes": "cafe", "bebidas-naturales-frozen": "jarra", "gaseosas-agua": "jarra",
    "cervezas": "cerveza", "vinos": "vino", "cocteles-drinks": "coctel"
  };

  function normalizar(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  function claveIlustracion(producto) {
    var nombre = normalizar(producto.nombre);
    for (var i = 0; i < REGLAS.length; i++) if (REGLAS[i][0].test(nombre)) return REGLAS[i][1];
    return POR_CATEGORIA[producto.categoria] || "criollo";
  }

  function svgIlustracion(clave) {
    return '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' + (ILUS[clave] || ILUS.criollo) + "</svg>";
  }

  /* ---------- Íconos de sección ---------- */
  var ICONOS = {
    "desayunos": '<path d="M4 11h12v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 12h2a2 2 0 0 1 0 4h-2"/><circle cx="18" cy="5" r="2.2"/><path d="M18 1.5v1M21.5 5h-1M14.5 5h1"/>',
    "entradas": '<ellipse cx="12" cy="13" rx="8" ry="6" transform="rotate(-15 12 13)"/><circle cx="9" cy="12" r=".9"/><circle cx="13" cy="14" r=".9"/><circle cx="15" cy="10.5" r=".9"/>',
    "sopas": '<path d="M3 10h18"/><path d="M5 10v3a7 7 0 0 0 14 0v-3"/><path d="M2 10h1M21 10h1"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M13.5 7c0-1.5 1.5-1.5 1.5-3"/>',
    "platos-de-fondo": '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 9V7M10 7h4"/>',
    "platos-fin-de-semana": '<path d="M2 12c4-6 11-6 15 0-4 6-11 6-15 0z"/><path d="M17 12l4-3v6z"/><circle cx="7" cy="11" r=".9"/>',
    "promociones": '<path d="M12 2l4 10-4 10-4-10z"/><path d="M2 12h20"/>',
    "guarniciones": '<path d="M3 12h18a9 7 0 0 1-18 0z"/><path d="M7 12c0-3 2-5 5-5s5 2 5 5"/>',
    "jugos-bebidas-calientes": '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2"/><path d="M3 21h17M9 7c0-1.5 1.5-1.5 1.5-3"/>',
    "bebidas-naturales-frozen": '<path d="M6 7h12l-1.5 14h-9z"/><path d="M14 7l3-5M7 12h10"/>',
    "gaseosas-agua": '<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
    "cervezas": '<path d="M5 8h11v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M16 11h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M5 8a3 3 0 0 1 3-3 3 3 0 0 1 5 0 3 3 0 0 1 3 3"/>',
    "vinos": '<path d="M8 3h8v5a4 4 0 0 1-8 0z"/><path d="M12 12v8M8 21h8"/>',
    "cocteles-drinks": '<path d="M4 4h16l-8 9z"/><path d="M12 13v7M8 21h8M16 4l3-2.5"/>',
    "estrella": '<path d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.2 6.6 21 8 13.6 3 9l6.6-.4z"/>',
    "sol": '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    "fuego": '<path d="M12 22c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 3 2 4 6 4 8 0 4-3 7-7 7z"/><path d="M12 22c-2 0-3-1.5-3-3.5S12 15 12 13c1.5 1.5 3 3 3 5.5S14 22 12 22z"/>'
  };

  function icono(nombre, clase) {
    return '<svg class="' + (clase || "icono") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONOS[nombre] || ICONOS.estrella) + "</svg>";
  }

  return {
    claveIlustracion: claveIlustracion,
    ilustracion: function (producto) { return svgIlustracion(claveIlustracion(producto)); },
    ilustracionPorClave: svgIlustracion,
    icono: icono
  };
})();
