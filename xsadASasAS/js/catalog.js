(function () {
  var T = window.TAU, D = window.TAU_DATA;
  var SIZES = ["S", "M", "L", "XL"];
  var all = [];
  var params = new URLSearchParams(location.search);

  var $ = function (id) { return document.getElementById(id); };
  var grid = $("grid");

  function checks(boxId, name, items) {
    $(boxId).innerHTML = items.map(function (it) {
      return '<label><input type="checkbox" name="' + name + '" value="' + T.esc(it.value) + '"> ' + T.esc(it.label) + "</label>";
    }).join("");
  }
  checks("f-cat", "cat", D.CATEGORIES.map(function (c) { return { value: c.id, label: c.name }; }));
  checks("f-size", "size", SIZES.map(function (s) { return { value: s, label: s }; }));
  checks("f-color", "color", Object.keys(D.COLORS).map(function (c) { return { value: c, label: c }; }));

  function checked(name) {
    return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
  }

  // Начальные значения из адреса (?category=hoodies&new=1)
  var c0 = params.get("category");
  if (c0) { var el = document.querySelector('input[name="cat"][value="' + c0 + '"]'); if (el) el.checked = true; }
  if (params.get("new") === "1") $("f-new").checked = true;
  if (params.get("q")) $("q").value = params.get("q");

  function apply() {
    var q = $("q").value.trim().toLowerCase();
    var cats = checked("cat"), sizes = checked("size"), colors = checked("color");
    var pmin = parseFloat($("pmin").value), pmax = parseFloat($("pmax").value);
    var onlyStock = $("f-stock").checked, onlyNew = $("f-new").checked;

    var list = all.filter(function (p) {
      if (q && (p.name + " " + T.categoryName(p.category)).toLowerCase().indexOf(q) === -1) return false;
      if (cats.length && cats.indexOf(p.category) === -1) return false;
      if (!isNaN(pmin) && p.price < pmin) return false;
      if (!isNaN(pmax) && p.price > pmax) return false;
      if (onlyNew && !p.isNew) return false;
      // размер, цвет и наличие проверяем по вариантам вместе
      var okVariant = p.variants.some(function (v) {
        if (sizes.length && sizes.indexOf(v.size) === -1) return false;
        if (colors.length && colors.indexOf(v.color) === -1) return false;
        if (onlyStock && v.stock <= 0) return false;
        return true;
      });
      return okVariant;
    });

    var s = $("sort").value;
    if (s === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    if (s === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    if (s === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name, "ru"); });

    $("count").textContent = "Найдено: " + list.length;
    if (!list.length) {
      grid.style.display = "block";
      grid.innerHTML = '<div class="state"><strong>Ничего не найдено</strong>Попробуйте изменить поиск или сбросить фильтры.' +
        '<br><button type="button" class="btn ghost small" id="reset2">Сбросить фильтры</button></div>';
      $("reset2").addEventListener("click", reset);
      return;
    }
    grid.style.display = "";
    var withCard = list.map(function (p) {
      var img = T.productImages(p)[0];
      var out = T.totalStock(p) === 0;
      return '<a class="card" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="ph"><img src="' + img + '" alt="Демо-фото: ' + T.esc(p.name) + '" loading="lazy" width="400" height="500"></div>' +
        "<h3>" + T.esc(p.name) + "</h3>" +
        '<div class="price">' + T.money(p.price) + "</div>" +
        '<div class="tag">' + (out ? "Нет в наличии" : (p.isNew ? "Новинка" : "")) + "</div></a>";
    }).join("");
    grid.innerHTML = withCard;
  }

  function reset() {
    document.getElementById("filters").reset();
    $("q").value = ""; $("sort").value = "default";
    apply();
  }

  // Текстовые поля обновляют список только по "input": событие "change" срабатывает
  // при потере фокуса и перерисовывало бы список раньше клика по кнопке.
  ["q", "pmin", "pmax"].forEach(function (id) { $(id).addEventListener("input", apply); });
  $("sort").addEventListener("change", apply);
  $("filters").addEventListener("change", function (e) {
    if (e.target.type === "checkbox") apply();
  });
  $("reset-filters").addEventListener("click", reset);
  $("filters-toggle").addEventListener("click", function () {
    var open = $("filters").classList.toggle("open");
    this.setAttribute("aria-expanded", String(open));
  });

  T.getProducts().then(function (items) { all = items; apply(); })
    .catch(function () {
      grid.innerHTML = '<div class="state" role="alert"><strong>Не удалось загрузить товары</strong>Обновите страницу.</div>';
    });
})();
