(function () {
  var T = window.TAU;
  var view = document.getElementById("view");
  var ORDERS_KEY = "tau_demo_orders_v1";
  var products = [];

  function find(id) { return products.filter(function (p) { return p.id === id; })[0]; }

  function nextNumber() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch (e) {}
    var n = list.length + 1;
    return "DEMO-" + String(n).padStart(3, "0");
  }
  // Пока база не подключена, тестовые заказы остаются только в этом браузере.
  function saveOrder(order) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch (e) {}
    list.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  }

  function lines(items) {
    var total = 0;
    var out = items.map(function (it) {
      var p = find(it.productId);
      var stock = T.stockOf(p, it.color, it.size);
      var sum = p.price * it.qty;
      total += sum;
      return { it: it, p: p, stock: stock, sum: sum };
    });
    return { rows: out, total: total };
  }

  // Режим с базой: заказ создаёт серверная функция create_demo_order.
  // Цену и наличие она проверяет сама, цены из браузера не принимаются.
  function submitRemote(form, v, L2) {
    var errBox = document.getElementById("form-e");
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Отправка…";
    T.sb.rpc("create_demo_order", {
      p_name: v.name, p_phone: v.phone, p_city: v.city, p_address: v.address,
      p_items: L2.rows.map(function (r) {
        return { product_id: r.p.id, color: r.it.color, size: r.it.size, qty: r.it.qty };
      })
    }).then(function (res) {
      if (res.error) {
        var m = String(res.error.message || "");
        errBox.textContent = m.indexOf("отключены") !== -1
          ? "Демо-заказы сейчас отключены владельцем."
          : "Не удалось создать тестовый заказ. Проверьте корзину и попробуйте ещё раз.";
        btn.disabled = false; btn.textContent = "Создать тестовый заказ";
        return;
      }
      var number = res.data;
      // Отчёт владельцу в Telegram: сбой тут не влияет на уже сохранённый заказ.
      try {
        fetch("/.netlify/functions/notify-order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number: number })
        }).catch(function () {});
      } catch (e2) {}
      T.clearCart();
      view.innerHTML = '<div class="confirm" role="status"><p class="eyebrow">Тестовый заказ создан</p>' +
        '<div class="num">' + T.esc(number) + "</div>" +
        "<p>Сумма: " + T.money(L2.total) + "</p>" +
        "<p><strong>Демо-версия: заказ не оплачивается и не отправляется.</strong> Тестовая запись сохранена в базе отдельно от настоящих заказов.</p>" +
        '<a class="btn" href="catalog.html">Вернуться в каталог</a></div>';
      window.scrollTo(0, 0);
    }).catch(function () {
      errBox.textContent = "Нет связи с сервером. Тестовый заказ не создан.";
      btn.disabled = false; btn.textContent = "Создать тестовый заказ";
    });
  }

  function render() {
    var items = T.readCart().filter(function (i) { return find(i.productId); });
    if (!items.length) {
      view.innerHTML = '<div class="state"><strong>Корзина пуста</strong>Сначала добавьте товары.' +
        '<br><a class="btn small" href="catalog.html">В каталог</a></div>';
      return;
    }
    var L = lines(items);
    var summaryRows = L.rows.map(function (r) {
      return '<div class="order-line"><span>' + T.esc(r.p.name) + ", " + T.esc(r.it.color) + ", " + T.esc(r.it.size) + " × " + r.it.qty +
        "</span><span>" + T.money(r.sum) + "</span></div>";
    }).join("");

    view.innerHTML =
      '<div class="two-col"><form class="form" id="form" novalidate>' +
      '<div class="field"><label for="name">Имя (тестовое)</label><input id="name" name="name" type="text" autocomplete="off" placeholder="ТЕСТОВЫЙ ПОКУПАТЕЛЬ" required aria-describedby="name-e"><p class="field-error" id="name-e"></p></div>' +
      '<div class="field"><label for="phone">Телефон (тестовый)</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="+7 700 000 00 00" required aria-describedby="phone-h phone-e"><p class="hint" id="phone-h">Формат: +7 и 10 цифр. Не вводите настоящий номер.</p><p class="field-error" id="phone-e"></p></div>' +
      '<div class="row"><div class="field"><label for="city">Город (демо)</label><input id="city" name="city" type="text" autocomplete="off" placeholder="ДЕМО-ГОРОД" required aria-describedby="city-e"><p class="field-error" id="city-e"></p></div>' +
      '<div class="field"><label for="address">Адрес (демо)</label><input id="address" name="address" type="text" autocomplete="off" placeholder="ДЕМО-АДРЕС" required aria-describedby="address-e"><p class="field-error" id="address-e"></p></div></div>' +
      '<div class="field"><div class="checks"><label style="text-transform:none;letter-spacing:0;font-weight:400;font-size:15px"><input type="checkbox" id="agree" aria-describedby="agree-e"> Я понимаю, что это демо: заказ не оплачивается и не отправляется, а данные вымышленные.</label></div><p class="field-error" id="agree-e"></p></div>' +
      '<p class="field-error" id="form-e" role="alert"></p>' +
      '<button class="btn" type="submit">Создать тестовый заказ</button></form>' +
      '<aside class="summary" aria-label="Ваш заказ"><h3>Ваш заказ</h3>' + summaryRows +
      '<div class="total"><span>Итого</span><span>' + T.money(L.total) + "</span></div>" +
      '<p class="hint">Оплаты и доставки нет. Статус «оплачено» в демо не используется.</p></aside></div>';

    var form = document.getElementById("form");
    function setErr(id, msg) {
      var input = document.getElementById(id), e = document.getElementById(id + "-e");
      if (e) e.textContent = msg || "";
      if (input && input.type !== "checkbox") input.setAttribute("aria-invalid", msg ? "true" : "false");
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = {
        name: form.name.value.trim(), phone: form.phone.value.trim(),
        city: form.city.value.trim(), address: form.address.value.trim()
      };
      var bad = false, first = null;
      function check(id, cond, msg) { setErr(id, cond ? "" : msg); if (!cond) { bad = true; if (!first) first = id; } }
      check("name", v.name.length >= 2, "Введите имя (минимум 2 символа).");
      var digits = v.phone.replace(/\D/g, "");
      check("phone", /^(7|8)?\d{10}$/.test(digits) && digits.length >= 10, "Введите телефон: +7 и 10 цифр.");
      check("city", v.city.length >= 2, "Укажите город.");
      check("address", v.address.length >= 3, "Укажите адрес.");
      var agree = document.getElementById("agree").checked;
      document.getElementById("agree-e").textContent = agree ? "" : "Подтвердите, что понимаете: это демо.";
      if (!agree) { bad = true; if (!first) first = "agree"; }
      document.getElementById("form-e").textContent = "";
      if (bad) { document.getElementById(first).focus(); return; }

      // проверяем остатки ещё раз
      var cur = T.readCart(); var L2 = lines(cur);
      var problem = L2.rows.some(function (r) { return r.stock < r.it.qty; });
      if (problem) {
        document.getElementById("form-e").textContent = "Некоторых товаров не хватает на складе. Вернитесь в корзину и проверьте количество.";
        return;
      }
      if (T.sb) { submitRemote(form, v, L2); return; }
      var order = {
        number: nextNumber(), createdAt: new Date().toISOString(), status: "Тестовый",
        customer: v.name, phone: v.phone, city: v.city, address: v.address, total: L2.total,
        items: L2.rows.map(function (r) { return { name: r.p.name, color: r.it.color, size: r.it.size, qty: r.it.qty, price: r.p.price }; })
      };
      try { saveOrder(order); } catch (e) {
        document.getElementById("form-e").textContent = "Не удалось сохранить тестовый заказ в браузере.";
        return;
      }
      T.clearCart();
      view.innerHTML = '<div class="confirm" role="status"><p class="eyebrow">Тестовый заказ создан</p>' +
        '<div class="num">' + T.esc(order.number) + "</div>" +
        "<p>Сумма: " + T.money(order.total) + "</p>" +
        "<p><strong>Демо-версия: заказ не оплачивается и не отправляется.</strong> Сейчас заказ сохранён только в этом браузере: база данных ещё не подключена.</p>" +
        '<a class="btn" href="catalog.html">Вернуться в каталог</a></div>';
      window.scrollTo(0, 0);
    });
  }

  T.getProducts().then(function (items) { products = items; render(); })
    .catch(function () {
      view.innerHTML = '<div class="state" role="alert"><strong>Не удалось загрузить данные</strong>Обновите страницу.</div>';
    });
})();
