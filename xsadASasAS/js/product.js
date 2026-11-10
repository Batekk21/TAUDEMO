(function () {
  var T = window.TAU, D = window.TAU_DATA;
  var SIZES = ["S", "M", "L", "XL"];
  var view = document.getElementById("view");
  var id = new URLSearchParams(location.search).get("id");

  function notFound() {
    document.title = "Товар не найден — ТАУ";
    view.innerHTML = '<div class="state" role="alert"><strong>Товар не найден</strong>Возможно, он скрыт или удалён.' +
      '<br><a class="btn ghost small" href="catalog.html">В каталог</a></div>';
  }

  T.getProducts().then(function (items) {
    var p = items.filter(function (x) { return x.id === id; })[0];
    if (!p) return notFound();
    render(p);
  }).catch(function () {
    view.innerHTML = '<div class="state" role="alert"><strong>Не удалось загрузить товар</strong>Обновите страницу.</div>';
  });

  function render(p) {
    document.title = p.name + " — ТАУ";
    var imgs = T.productImages(p);
    var colors = [];
    p.variants.forEach(function (v) { if (colors.indexOf(v.color) === -1) colors.push(v.color); });
    var state = { color: colors[0], size: null, qty: 1, img: 0 };

    view.innerHTML =
      '<p class="eyebrow"><a href="catalog.html">Каталог</a> / ' + T.esc(T.categoryName(p.category)) + "</p>" +
      '<div class="product">' +
      '<div class="gallery"><div class="main"><img id="main-img" src="' + imgs[0] + '" alt="Демо-фото: ' + T.esc(p.name) + '" width="400" height="500"></div>' +
      '<div class="thumbs" id="thumbs"></div></div>' +
      '<div class="buy">' +
      "<div><h2>" + T.esc(p.name) + '</h2><div class="price" style="margin-top:12px">' + T.money(p.price) + "</div></div>" +
      "<p>" + T.esc(p.description) + "</p>" +
      '<div><span class="label" id="lc">Цвет: <span id="color-name"></span></span><div class="opts" id="colors" role="group" aria-labelledby="lc"></div></div>' +
      '<div><span class="label" id="ls">Размер</span><div class="opts" id="sizes" role="group" aria-labelledby="ls"></div>' +
      '<p class="field-error" id="size-error" role="alert"></p></div>' +
      '<div class="stock" id="stock" aria-live="polite"></div>' +
      '<div><span class="label" id="lq">Количество</span>' +
      '<div class="qty" role="group" aria-labelledby="lq"><button type="button" id="minus" aria-label="Уменьшить">−</button>' +
      '<output id="qty" aria-live="polite">1</output><button type="button" id="plus" aria-label="Увеличить">+</button></div></div>' +
      '<button type="button" class="btn" id="add">Добавить в корзину</button>' +
      '<p class="notice">' + T.esc(T.DEMO_TEXT) + "</p>" +
      "</div></div>";

    var $ = function (x) { return document.getElementById(x); };

    function drawThumbs() {
      $("thumbs").innerHTML = imgs.map(function (src, i) {
        return '<button type="button" data-i="' + i + '" aria-pressed="' + (state.img === i) + '" aria-label="Фото ' + (i + 1) + '"><img src="' + src + '" alt="" width="72" height="90"></button>';
      }).join("");
      $("main-img").src = imgs[state.img];
    }
    $("thumbs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]");
      if (!b) return;
      state.img = +b.getAttribute("data-i"); drawThumbs();
    });

    function drawColors() {
      $("color-name").textContent = state.color;
      $("colors").innerHTML = colors.map(function (c) {
        return '<button type="button" class="opt" data-c="' + T.esc(c) + '" aria-pressed="' + (c === state.color) + '">' + T.esc(c) + "</button>";
      }).join("");
    }
    function drawSizes() {
      $("sizes").innerHTML = SIZES.map(function (s) {
        var st = T.stockOf(p, state.color, s);
        return '<button type="button" class="opt" data-s="' + s + '" aria-pressed="' + (state.size === s) + '"' + (st <= 0 ? ' disabled aria-label="' + s + ', нет в наличии"' : "") + ">" + s + "</button>";
      }).join("");
    }
    function drawStock() {
      var el = $("stock");
      if (!state.size) { el.textContent = "Выберите размер, чтобы увидеть наличие."; return; }
      var st = T.stockOf(p, state.color, state.size);
      el.textContent = st > 0 ? "В наличии: " + st + " шт." : "Нет в наличии";
    }
    function drawQty() {
      var st = state.size ? T.stockOf(p, state.color, state.size) : 99;
      state.qty = Math.max(1, Math.min(state.qty, st || 1));
      $("qty").textContent = state.qty;
      $("minus").disabled = state.qty <= 1;
      $("plus").disabled = state.qty >= st;
    }
    function drawAll() { drawColors(); drawSizes(); drawStock(); drawQty(); }

    $("colors").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-c]"); if (!b) return;
      state.color = b.getAttribute("data-c");
      if (state.size && T.stockOf(p, state.color, state.size) <= 0) state.size = null;
      $("size-error").textContent = "";
      drawAll();
    });
    $("sizes").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-s]"); if (!b || b.disabled) return;
      state.size = b.getAttribute("data-s");
      $("size-error").textContent = "";
      state.qty = 1;
      drawAll();
    });
    $("minus").addEventListener("click", function () { state.qty--; drawQty(); });
    $("plus").addEventListener("click", function () { state.qty++; drawQty(); });
    $("add").addEventListener("click", function () {
      if (!state.size) { $("size-error").textContent = "Выберите размер."; return; }
      var st = T.stockOf(p, state.color, state.size);
      if (st <= 0) return;
      T.addToCart({ productId: p.id, color: state.color, size: state.size, qty: state.qty }, st);
      T.toast("Добавлено в корзину");
    });

    drawThumbs(); drawAll();
  }
})();
