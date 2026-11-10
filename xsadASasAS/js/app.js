// Общие функции: шапка, подвал, корзина, формат цены, заглушки фото.
(function () {
  var D = window.TAU_DATA;
  var CFG = window.TAU_CONFIG || {};
  var sb = null; // клиент Supabase; остаётся null, пока config.js пустой (демо-режим)
  try {
    if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase) {
      sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    }
  } catch (e) { sb = null; }
  var CART_KEY = "tau_cart_v1";
  var DEMO_TEXT = "Демо-версия: заказ не оплачивается и не отправляется";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return Number(n).toLocaleString("ru-RU").replace(/ /g, " ") + " ₸";
  }

  // Заглушка вместо фото (с пометкой «демо»)
  function placeholder(label, shade) {
    var bg = ["#e9e9e9", "#dcdcdc", "#cfcfcf"][shade % 3];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">' +
      '<rect width="400" height="500" fill="' + bg + '"/>' +
      '<path d="M120 150 L160 120 Q200 150 240 120 L280 150 L260 200 L250 190 L250 380 L150 380 L150 190 L140 200 Z" fill="none" stroke="#0a0a0a" stroke-width="3"/>' +
      '<text x="200" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" letter-spacing="3" fill="#0a0a0a">ДЕМО · ФОТО</text>' +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function productImages(p) {
    if (sb && p.images && p.images.length) {
      return p.images.map(function (path) {
        return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      });
    }
    var base = 0;
    for (var i = 0; i < p.id.length; i++) base += p.id.charCodeAt(i);
    return [0, 1, 2].map(function (k) { return placeholder(p.name, base + k); });
  }

  // Товары. Сейчас — демо-данные. Позже здесь будет запрос к Supabase.
  function getProducts() {
    if (sb) {
      return sb.from("products")
        .select("id,name,description,price,category,is_new,published,images,product_variants(color,size,stock)")
        .eq("published", true)
        .order("created_at", { ascending: true })
        .then(function (res) {
          if (res.error) throw res.error;
          return res.data.map(function (r) {
            return {
              id: r.id, name: r.name, description: r.description, price: r.price,
              category: r.category, isNew: r.is_new, published: r.published,
              images: r.images || [], variants: r.product_variants || []
            };
          });
        });
    }
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(D.PRODUCTS.filter(function (p) { return p.published; }));
      }, 250);
    });
  }

  function categoryName(id) {
    var c = D.CATEGORIES.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "";
  }

  function totalStock(p) {
    return p.variants.reduce(function (a, v) { return a + v.stock; }, 0);
  }

  function stockOf(p, color, size) {
    var v = p.variants.filter(function (x) { return x.color === color && x.size === size; })[0];
    return v ? v.stock : 0;
  }

  // ---- Корзина ----
  function readCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
    updateBadge();
  }
  function cartCount() {
    return readCart().reduce(function (a, i) { return a + i.qty; }, 0);
  }
  function addToCart(item, maxStock) {
    var items = readCart();
    var found = items.filter(function (i) {
      return i.productId === item.productId && i.color === item.color && i.size === item.size;
    })[0];
    if (found) found.qty = Math.min(found.qty + item.qty, maxStock);
    else items.push({ productId: item.productId, color: item.color, size: item.size, qty: Math.min(item.qty, maxStock) });
    writeCart(items);
  }
  function clearCart() { writeCart([]); }

  function updateBadge() {
    var el = document.getElementById("cart-count");
    if (el) el.textContent = cartCount();
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ---- Шапка и подвал ----
  function renderChrome() {
    var page = document.body.getAttribute("data-page") || "";
    function cur(name) { return page === name ? ' aria-current="page"' : ""; }

    var header = document.getElementById("site-header");
    if (header) {
      header.innerHTML =
        '<a class="skip" href="#main">К содержимому</a>' +
        '<div class="demo-bar">' + esc(DEMO_TEXT) + "</div>" +
        '<div class="header">' +
        '<a class="logo" href="index.html" aria-label="ТАУ — на главную">Тау</a>' +
        '<nav class="nav" aria-label="Основное меню">' +
        '<a href="catalog.html"' + cur("catalog") + ">Каталог</a>" +
        '<a href="about.html"' + cur("about") + ">О магазине</a>" +
        '<a href="contacts.html"' + cur("contacts") + ">Контакты</a>" +
        '<a href="cart.html"' + cur("cart") + '>Корзина (<span id="cart-count">0</span>)</a>' +
        "</nav></div>";
    }
    var footer = document.getElementById("site-footer");
    if (footer) {
      footer.innerHTML =
        '<div class="footer">' +
        '<div><p><strong>ТАУ</strong> — вымышленный бренд для демонстрации.</p>' +
        '<p class="small">Название, товары и сведения на сайте — примеры. Владелец заменит их перед реальным запуском.</p></div>' +
        '<div><p><strong>Магазин</strong></p><ul>' +
        '<li><a href="catalog.html">Каталог</a></li>' +
        '<li><a href="cart.html">Корзина</a></li>' +
        '<li><a href="about.html">О магазине</a></li></ul></div>' +
        '<div><p><strong>Информация</strong></p><ul>' +
        '<li><a href="delivery.html">Доставка и возврат</a></li>' +
        '<li><a href="contacts.html">Контакты</a></li>' +
        '<li><a href="privacy.html">Конфиденциальность</a></li></ul></div>' +
        "</div>";
    }
    updateBadge();
  }

  document.addEventListener("DOMContentLoaded", renderChrome);

  window.TAU = {
    esc: esc, money: money, placeholder: placeholder, productImages: productImages,
    getProducts: getProducts, categoryName: categoryName, totalStock: totalStock, stockOf: stockOf,
    readCart: readCart, writeCart: writeCart, addToCart: addToCart, clearCart: clearCart,
    cartCount: cartCount, toast: toast, DEMO_TEXT: DEMO_TEXT, sb: sb
  };
})();
