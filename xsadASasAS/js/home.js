(function () {
  var T = window.TAU, D = window.TAU_DATA;

  var cats = document.getElementById("cats");
  cats.innerHTML = D.CATEGORIES.map(function (c, i) {
    return '<a class="cat" href="catalog.html?category=' + T.esc(c.id) + '">' +
      "<span>0" + (i + 1) + "</span><strong>" + T.esc(c.name) + "</strong></a>";
  }).join("");

  window.TAU_renderCards = function (list) {
    return list.map(function (p) {
      var img = T.productImages(p)[0];
      var out = T.totalStock(p) === 0;
      return '<a class="card" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="ph"><img src="' + img + '" alt="Демо-фото: ' + T.esc(p.name) + '" loading="lazy" width="400" height="500"></div>' +
        "<h3>" + T.esc(p.name) + "</h3>" +
        '<div class="price">' + T.money(p.price) + "</div>" +
        '<div class="tag">' + (out ? "Нет в наличии" : (p.isNew ? "Новинка" : "")) + "</div></a>";
    }).join("");
  };

  var box = document.getElementById("new-grid");
  T.getProducts().then(function (items) {
    var list = items.filter(function (p) { return p.isNew; }).slice(0, 4);
    box.innerHTML = list.length
      ? window.TAU_renderCards(list)
      : '<div class="state"><strong>Пока нет новинок</strong>Загляните в каталог.</div>';
  }).catch(function () {
    box.innerHTML = '<div class="state" role="alert"><strong>Не удалось загрузить товары</strong>Обновите страницу.</div>';
  });
})();
