// Демо-данные витрины. Все товары вымышленные.
// Позже эти данные будут браться из Supabase (см. getProducts в app.js).
(function () {
  var COLORS = {
    "Чёрный": "#111111",
    "Белый": "#f4f4f4",
    "Серый": "#8a8a8a"
  };

  var CATEGORIES = [
    { id: "hoodies", name: "Худи" },
    { id: "tshirts", name: "Футболки" },
    { id: "pants", name: "Брюки" },
    { id: "outerwear", name: "Верхняя одежда" }
  ];

  function v(color, sizes) {
    // sizes: { S: 3, M: 0, ... }  — остаток по каждому размеру
    return Object.keys(sizes).map(function (s) {
      return { color: color, size: s, stock: sizes[s] };
    });
  }

  var DESC = "Демо-описание. Настоящий текст добавит владелец магазина в админ-панели.";

  var PRODUCTS = [
    { id: "demo-hoodie-basic", name: "Худи «Базовое»", category: "hoodies", price: 18000, isNew: true, published: true,
      description: DESC,
      variants: [].concat(v("Чёрный", { S: 4, M: 6, L: 3, XL: 0 }), v("Серый", { S: 2, M: 0, L: 5, XL: 1 })) },
    { id: "demo-hoodie-zip", name: "Худи на молнии", category: "hoodies", price: 21000, isNew: false, published: true,
      description: DESC,
      variants: [].concat(v("Чёрный", { S: 0, M: 2, L: 2, XL: 2 }), v("Белый", { S: 3, M: 3, L: 0, XL: 0 })) },
    { id: "demo-tee-plain", name: "Футболка «Ровная»", category: "tshirts", price: 7500, isNew: true, published: true,
      description: DESC,
      variants: [].concat(v("Белый", { S: 8, M: 10, L: 6, XL: 4 }), v("Чёрный", { S: 7, M: 9, L: 5, XL: 0 })) },
    { id: "demo-tee-long", name: "Лонгслив", category: "tshirts", price: 9500, isNew: false, published: true,
      description: DESC,
      variants: [].concat(v("Серый", { S: 3, M: 4, L: 4, XL: 2 })) },
    { id: "demo-pants-wide", name: "Брюки широкие", category: "pants", price: 16500, isNew: true, published: true,
      description: DESC,
      variants: [].concat(v("Чёрный", { S: 2, M: 5, L: 5, XL: 2 }), v("Серый", { S: 0, M: 0, L: 0, XL: 0 })) },
    { id: "demo-pants-jogger", name: "Джоггеры", category: "pants", price: 14000, isNew: false, published: true,
      description: DESC,
      variants: [].concat(v("Серый", { S: 4, M: 4, L: 3, XL: 3 }), v("Чёрный", { S: 1, M: 2, L: 0, XL: 0 })) },
    { id: "demo-coat-long", name: "Пальто длинное", category: "outerwear", price: 45000, isNew: false, published: true,
      description: DESC,
      variants: [].concat(v("Чёрный", { S: 1, M: 2, L: 2, XL: 0 })) },
    { id: "demo-jacket-light", name: "Куртка лёгкая", category: "outerwear", price: 32000, isNew: true, published: true,
      description: DESC,
      variants: [].concat(v("Серый", { S: 2, M: 3, L: 1, XL: 1 }), v("Чёрный", { S: 0, M: 2, L: 2, XL: 0 })) }
  ];

  window.TAU_DATA = { COLORS: COLORS, CATEGORIES: CATEGORIES, PRODUCTS: PRODUCTS };
})();
