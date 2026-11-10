(function () {
  var T = window.TAU;
  var view = document.getElementById("view");
  var products = [];

  function find(id) { return products.filter(function (p) { return p.id === id; })[0]; }

  function render() {
    var items = T.readCart();
    // убираем позиции, которых больше нет в магазине
    var valid = items.filter(function (i) { return find(i.productId); });
    if (valid.length !== items.length) { T.writeCart(valid); items = valid; }

    if (!items.length) {
      view.innerHTML = '<div class="state"><strong>Корзина пуста</strong>Добавьте товары из каталога.' +
        '<br><a class="btn small" href="catalog.html">В каталог</a></div>';
      return;
    }

    var total = 0;
    var rows = items.map(function (it, idx) {
      var p = find(it.productId);
      var stock = T.stockOf(p, it.color, it.size);
      var qty = Math.min(it.qty, stock);
      var sum = p.price * qty;
      total += sum;
      var warn = stock <= 0 ? '<p class="field-error">Этого варианта больше нет в наличии. Удалите позицию.</p>' :
        (it.qty > stock ? '<p class="field-error">Доступно только ' + stock + " шт.</p>" : "");
      return '<div class="cart-row" data-i="' + idx + '">' +
        '<div class="ph"><img src="' + T.productImages(p)[0] + '" alt="" width="96" height="120"></div>' +
        "<div><h3><a href=\"product.html?id=" + encodeURIComponent(p.id) + '">' + T.esc(p.name) + "</a></h3>" +
        '<div class="meta">' + T.esc(it.color) + ", размер " + T.esc(it.size) + " · " + T.money(p.price) + "</div>" + warn +
        '<div class="row-actions"><div class="qty" role="group" aria-label="Количество">' +
        '<button type="button" data-act="minus" aria-label="Уменьшить"' + (it.qty <= 1 ? " disabled" : "") + ">−</button>" +
        "<output>" + it.qty + "</output>" +
        '<button type="button" data-act="plus" aria-label="Увеличить"' + (it.qty >= stock ? " disabled" : "") + ">+</button></div>" +
        '<button type="button" class="link-btn" data-act="remove">Убрать</button></div></div>' +
        '<div class="sum">' + T.money(sum) + "</div></div>";
    }).join("");

    view.innerHTML = '<div class="two-col"><div>' + rows + "</div>" +
      '<aside class="summary" aria-label="Итого"><div class="total"><span>Итого</span><span>' + T.money(total) + "</span></div>" +
      '<p class="hint">Демо-версия: заказ не оплачивается и не отправляется. Доставка не рассчитывается.</p>' +
      '<a class="btn" href="checkout.html">Перейти к тестовому оформлению</a></aside></div>';
  }

  view.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var row = b.closest(".cart-row"); var idx = +row.getAttribute("data-i");
    var items = T.readCart(); var it = items[idx]; if (!it) return;
    var p = find(it.productId); var stock = p ? T.stockOf(p, it.color, it.size) : 0;
    var act = b.getAttribute("data-act");
    if (act === "remove") items.splice(idx, 1);
    if (act === "minus") it.qty = Math.max(1, it.qty - 1);
    if (act === "plus") it.qty = Math.min(stock, it.qty + 1);
    T.writeCart(items); render();
  });

  T.getProducts().then(function (items) { products = items; render(); })
    .catch(function () {
      view.innerHTML = '<div class="state" role="alert"><strong>Не удалось загрузить корзину</strong>Обновите страницу.</div>';
    });
})();
