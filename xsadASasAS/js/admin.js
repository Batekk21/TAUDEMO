// Админ-панель владельца. Все права проверяет база (RLS); экран только удобство.
(function () {
  var T = window.TAU, D = window.TAU_DATA, sb = T.sb;
  var root = document.getElementById("admin");
  var msgBox = document.getElementById("msg");
  var SIZES = ["S", "M", "L", "XL"];
  var COLORS = Object.keys(D.COLORS);
  var STATUSES = ["Тестовый", "В работе (демо)", "Выполнен (демо)", "Отменён (демо)"];
  var BUCKET = "product-images";
  var MAX_IMG = 3 * 1024 * 1024;
  var session = null, role = null;
  var tab = "products";
  var form = null; // состояние формы товара: { id, images[], newFiles[], variants[] }

  function msg(text) { msgBox.textContent = text || ""; if (text) msgBox.scrollIntoView({ block: "nearest" }); }
  function opts(list, cur) {
    return list.map(function (x) { return '<option value="' + T.esc(x) + '"' + (x === cur ? " selected" : "") + ">" + T.esc(x) + "</option>"; }).join("");
  }
  function pubUrl(path) { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }

  // ---------- Старт ----------
  if (!sb) {
    root.innerHTML = '<div class="state"><strong>База не подключена</strong>Откройте файл js/config.js и впишите адрес проекта и публичный ключ Supabase.</div>';
    return;
  }
  sb.auth.getSession().then(function (r) {
    session = r.data && r.data.session;
    if (!session) return renderLogin();
    return afterLogin();
  });

  // ---------- Вход ----------
  function renderLogin() {
    root.innerHTML = '<form class="form" id="login" style="max-width:420px" novalidate>' +
      '<div class="field"><label for="email">Почта</label><input id="email" type="text" autocomplete="username" inputmode="email" required></div>' +
      '<div class="field"><label for="pass">Пароль</label><input id="pass" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn" type="submit">Войти</button></form>';
    document.getElementById("login").addEventListener("submit", function (e) {
      e.preventDefault(); msg("");
      var email = document.getElementById("email").value.trim(), pass = document.getElementById("pass").value;
      if (!email || !pass) return msg("Введите почту и пароль.");
      sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
        if (r.error || !r.data.session) return msg("Неверная почта или пароль.");
        session = r.data.session; afterLogin();
      });
    });
  }

  function afterLogin() {
    return sb.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle().then(function (r) {
      role = r.data && r.data.role;
      if (!role) {
        return sb.auth.signOut().then(function () {
          session = null; renderLogin(); msg("У этой учётной записи нет доступа к админ-панели.");
        });
      }
      msg(""); renderApp();
    });
  }

  function renderApp() {
    root.innerHTML = '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px">' +
      '<span class="hint">Вы вошли: ' + T.esc(session.user.email) + " (" + T.esc(role === "owner" ? "владелец" : "администратор") + ")</span>" +
      '<button type="button" class="link-btn" id="logout">Выйти</button></div>' +
      '<div class="tabs" role="tablist">' +
      '<button type="button" class="tab" data-tab="products" role="tab">Товары</button>' +
      '<button type="button" class="tab" data-tab="orders" role="tab">Тестовые заказы</button>' +
      '<button type="button" class="tab" data-tab="settings" role="tab">Настройки</button></div>' +
      '<div id="panel"></div>';
    document.getElementById("logout").addEventListener("click", function () {
      sb.auth.signOut().then(function () { session = null; role = null; msg(""); renderLogin(); });
    });
    root.querySelector(".tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tab]"); if (!b) return;
      tab = b.getAttribute("data-tab"); form = null; msg(""); showTab();
    });
    showTab();
  }

  function showTab() {
    Array.prototype.forEach.call(root.querySelectorAll(".tab"), function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === tab));
    });
    if (tab === "products") return form ? renderForm() : loadProducts();
    if (tab === "orders") return loadOrders();
    return loadSettings();
  }
  function panel() { return document.getElementById("panel"); }

  // ---------- Товары: список ----------
  function loadProducts() {
    panel().innerHTML = '<p class="loading">Загрузка…</p>';
    sb.from("products").select("*, product_variants(*)").order("created_at", { ascending: false }).then(function (r) {
      if (r.error) { panel().innerHTML = ""; return msg("Не удалось загрузить товары."); }
      var list = r.data;
      var rows = list.length ? list.map(function (p) {
        var total = p.product_variants.reduce(function (a, v) { return a + v.stock; }, 0);
        return '<div class="admin-row" data-id="' + T.esc(p.id) + '">' +
          "<div><strong>" + T.esc(p.name) + "</strong>" +
          '<div class="meta hint">' + T.esc(T.categoryName(p.category)) + " · " + T.money(p.price) + " · остаток: " + total + " шт. · " +
          (p.published ? "Опубликован" : "<strong>Скрыт</strong>") + "</div></div>" +
          '<div class="row-actions">' +
          '<button type="button" class="btn ghost small" data-act="edit">Изменить</button>' +
          '<button type="button" class="btn ghost small" data-act="toggle">' + (p.published ? "Скрыть" : "Опубликовать") + "</button>" +
          '<button type="button" class="btn ghost small" data-act="delete">Удалить</button></div></div>';
      }).join("") : '<div class="state"><strong>Товаров пока нет</strong>Нажмите «Добавить товар».</div>';
      panel().innerHTML = '<div style="margin-bottom:16px"><button type="button" class="btn" id="add-product">Добавить товар</button></div>' + rows;
      document.getElementById("add-product").addEventListener("click", function () { openForm(null); });
      panel().onclick = function (e) {
        var b = e.target.closest("button[data-act]"); if (!b) return;
        var id = b.closest(".admin-row").getAttribute("data-id");
        var p = list.filter(function (x) { return x.id === id; })[0];
        var act = b.getAttribute("data-act");
        if (act === "edit") openForm(p);
        if (act === "toggle") {
          sb.from("products").update({ published: !p.published }).eq("id", id).then(function (r2) {
            if (r2.error) return msg("Не удалось изменить видимость.");
            msg(""); loadProducts();
          });
        }
        if (act === "delete") {
          if (!window.confirm("Удалить товар «" + p.name + "»? Это нельзя отменить.")) return;
          sb.from("products").delete().eq("id", id).then(function (r2) {
            if (r2.error) return msg("Не удалось удалить товар.");
            if (p.images && p.images.length) sb.storage.from(BUCKET).remove(p.images);
            msg(""); loadProducts();
          });
        }
      };
    });
  }

  // ---------- Товары: форма ----------
  function openForm(p) {
    form = {
      id: p ? p.id : null,
      data: p || { name: "", description: "", price: "", category: D.CATEGORIES[0].id, is_new: false, published: true },
      images: p ? (p.images || []).slice() : [],
      newFiles: [],
      variants: p && p.product_variants.length
        ? p.product_variants.map(function (v) { return { color: v.color, size: v.size, stock: v.stock }; })
        : [{ color: COLORS[0], size: SIZES[0], stock: 0 }]
    };
    renderForm();
  }

  function renderForm() {
    var d = form.data;
    var cats = D.CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + (c.id === d.category ? " selected" : "") + ">" + T.esc(c.name) + "</option>"; }).join("");
    var imgs = form.images.map(function (path, i) {
      return '<div class="thumb-edit"><img src="' + T.esc(pubUrl(path)) + '" alt="Фото ' + (i + 1) + '" width="72" height="90">' +
        '<button type="button" class="link-btn" data-rm-img="' + i + '">Убрать</button></div>';
    }).join("");
    var vrows = form.variants.map(function (v, i) {
      return '<div class="variant-row" data-i="' + i + '">' +
        '<div class="field"><label>Цвет</label><select data-f="color">' + opts(COLORS, v.color) + "</select></div>" +
        '<div class="field"><label>Размер</label><select data-f="size">' + opts(SIZES, v.size) + "</select></div>" +
        '<div class="field"><label>Остаток, шт.</label><input data-f="stock" type="number" min="0" step="1" value="' + T.esc(v.stock) + '"></div>' +
        '<button type="button" class="link-btn" data-rm-var="' + i + '">Убрать</button></div>';
    }).join("");

    panel().innerHTML = '<h3 style="margin-bottom:16px">' + (form.id ? "Изменить товар" : "Новый товар") + "</h3>" +
      '<form class="form" id="pform" style="max-width:720px" novalidate>' +
      '<div class="field"><label for="f-name">Название</label><input id="f-name" type="text" maxlength="200" value="' + T.esc(d.name) + '"></div>' +
      '<div class="field"><label for="f-desc">Описание</label><textarea id="f-desc" rows="4">' + T.esc(d.description) + "</textarea></div>" +
      '<div class="row"><div class="field"><label for="f-price">Цена, ₸</label><input id="f-price" type="number" min="0" step="1" value="' + T.esc(d.price) + '"></div>' +
      '<div class="field"><label for="f-cat">Категория</label><select id="f-cat">' + cats + "</select></div></div>" +
      '<div class="checks"><label style="text-transform:none;letter-spacing:0;font-weight:400"><input type="checkbox" id="f-new"' + (d.is_new ? " checked" : "") + '> Показывать как новинку</label>' +
      '<label style="text-transform:none;letter-spacing:0;font-weight:400"><input type="checkbox" id="f-pub"' + (d.published ? " checked" : "") + '> Опубликован в магазине</label></div>' +
      '<div><span class="label">Фотографии</span><div class="thumbs-edit">' + (imgs || '<span class="hint">Пока нет фото: в магазине будет заглушка «демо».</span>') + "</div>" +
      '<input id="f-files" type="file" accept="image/*" multiple style="margin-top:10px"><p class="hint">До 3 МБ на фото. Только изображения.</p></div>' +
      '<div><span class="label">Размеры, цвета и остатки</span><div id="vars">' + vrows + '</div>' +
      '<button type="button" class="btn ghost small" id="add-var" style="margin-top:10px">Добавить вариант</button></div>' +
      '<p class="field-error" id="form-err" role="alert"></p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">Сохранить</button>' +
      '<button class="btn ghost" type="button" id="cancel">Отмена</button></div></form>';

    var pf = document.getElementById("pform");
    function err(t) { document.getElementById("form-err").textContent = t || ""; }
    function syncFields() {
      d.name = document.getElementById("f-name").value;
      d.description = document.getElementById("f-desc").value;
      d.price = document.getElementById("f-price").value;
      d.category = document.getElementById("f-cat").value;
      d.is_new = document.getElementById("f-new").checked;
      d.published = document.getElementById("f-pub").checked;
    }
    document.getElementById("f-files").addEventListener("change", function (e) {
      form.newFiles = Array.prototype.slice.call(e.target.files);
    });
    document.getElementById("cancel").addEventListener("click", function () { form = null; msg(""); showTab(); });
    document.getElementById("add-var").addEventListener("click", function () {
      syncFields(); form.variants.push({ color: COLORS[0], size: SIZES[0], stock: 0 }); renderForm();
    });
    pf.addEventListener("input", function (e) {
      var row = e.target.closest(".variant-row"); if (!row) return;
      var v = form.variants[+row.getAttribute("data-i")], f = e.target.getAttribute("data-f");
      v[f] = f === "stock" ? e.target.value : e.target.value;
    });
    pf.addEventListener("click", function (e) {
      var ri = e.target.getAttribute("data-rm-img"), rv = e.target.getAttribute("data-rm-var");
      if (ri !== null) { syncFields(); form.images.splice(+ri, 1); renderForm(); }
      if (rv !== null) { syncFields(); form.variants.splice(+rv, 1); renderForm(); }
    });
    pf.addEventListener("submit", function (e) {
      e.preventDefault(); syncFields(); err("");
      var name = d.name.trim(), price = Number(d.price);
      if (!name) return err("Введите название.");
      if (d.price === "" || !Number.isInteger(price) || price < 0) return err("Цена — целое число тенге, 0 или больше.");
      if (!form.variants.length) return err("Добавьте хотя бы один вариант (цвет, размер, остаток).");
      var seen = {};
      for (var i = 0; i < form.variants.length; i++) {
        var v = form.variants[i], st = Number(v.stock);
        if (v.stock === "" || !Number.isInteger(st) || st < 0) return err("Остаток — целое число, 0 или больше.");
        var k = v.color + "|" + v.size;
        if (seen[k]) return err("Повторяется вариант: " + v.color + ", " + v.size + ".");
        seen[k] = 1;
      }
      for (var j = 0; j < form.newFiles.length; j++) {
        var f = form.newFiles[j];
        if (!/^image\//.test(f.type)) return err("Файл «" + f.name + "» не изображение.");
        if (f.size > MAX_IMG) return err("Файл «" + f.name + "» больше 3 МБ.");
      }
      save(name, price, err, pf.querySelector('button[type="submit"]'));
    });
  }

  function save(name, price, err, btn) {
    var d = form.data;
    btn.disabled = true; btn.textContent = "Сохранение…";
    var base = { name: name, description: d.description.trim(), price: price, category: d.category, is_new: d.is_new, published: d.published };
    var prev = form.id ? (form.data.images || []) : [];
    function fail(e2) {
      console.error(e2);
      err("Не удалось сохранить: " + ((e2 && e2.message) || "ошибка связи") + ". Изменения могли сохраниться частично, проверьте список.");
      btn.disabled = false; btn.textContent = "Сохранить";
    }
    var step = form.id
      ? sb.from("products").update(base).eq("id", form.id).then(function (r) { if (r.error) throw r.error; return form.id; })
      : sb.from("products").insert(base).select("id").single().then(function (r) { if (r.error) throw r.error; form.id = r.data.id; return r.data.id; });

    step.then(function (id) {
      var uploads = form.newFiles.map(function (f, i) {
        var safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        var path = id + "/" + Date.now() + "-" + i + "-" + safe;
        return sb.storage.from(BUCKET).upload(path, f, { contentType: f.type }).then(function (r) { if (r.error) throw r.error; return path; });
      });
      return Promise.all(uploads).then(function (paths) {
        var images = form.images.concat(paths);
        return sb.from("products").update({ images: images }).eq("id", id).then(function (r) { if (r.error) throw r.error; return id; });
      });
    }).then(function (id) {
      return sb.from("product_variants").delete().eq("product_id", id).then(function (r) {
        if (r.error) throw r.error;
        var rows = form.variants.map(function (v) { return { product_id: id, color: v.color, size: v.size, stock: Number(v.stock) }; });
        return sb.from("product_variants").insert(rows);
      });
    }).then(function (r) {
      if (r && r.error) throw r.error;
      var removed = prev.filter(function (p) { return form.images.indexOf(p) === -1; });
      if (removed.length) sb.storage.from(BUCKET).remove(removed);
      form = null; msg(""); showTab(); T.toast("Товар сохранён");
    }).catch(fail);
  }

  // ---------- Заказы ----------
  function loadOrders() {
    panel().innerHTML = '<p class="loading">Загрузка…</p>';
    sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).then(function (r) {
      if (r.error) { panel().innerHTML = ""; return msg("Не удалось загрузить заказы."); }
      if (!r.data.length) { panel().innerHTML = '<div class="state"><strong>Тестовых заказов пока нет</strong>Они появятся после тестового оформления на сайте.</div>'; return; }
      panel().innerHTML = '<p class="notice" style="margin-bottom:16px">Это тестовые заказы. Статуса «оплачено» в демо нет.</p>' + r.data.map(function (o) {
        var items = o.order_items.map(function (i) {
          return '<div class="order-line"><span>' + T.esc(i.product_name) + ", " + T.esc(i.color) + ", " + T.esc(i.size) + " × " + i.qty + "</span><span>" + T.money(i.price * i.qty) + "</span></div>";
        }).join("");
        return '<div class="admin-order" data-id="' + T.esc(o.id) + '"><div class="admin-row-head"><strong>' + T.esc(o.number) + "</strong> · ТЕСТОВЫЙ ЗАКАЗ · " +
          T.esc(new Date(o.created_at).toLocaleString("ru-RU")) + "</div>" +
          '<div class="hint">' + T.esc(o.customer_name) + ", " + T.esc(o.phone) + ", " + T.esc(o.city) + ", " + T.esc(o.address) + "</div>" + items +
          '<div class="order-line"><strong>Итого</strong><strong>' + T.money(o.total) + "</strong></div>" +
          '<div class="field" style="max-width:260px;margin-top:8px"><label>Демо-статус</label><select data-status>' + opts(STATUSES, o.status) + "</select></div></div>";
      }).join("");
      panel().onchange = function (e) {
        if (!e.target.hasAttribute("data-status")) return;
        var id = e.target.closest(".admin-order").getAttribute("data-id");
        sb.from("orders").update({ status: e.target.value }).eq("id", id).then(function (r2) {
          if (r2.error) { msg("Не удалось изменить статус."); return loadOrders(); }
          msg(""); T.toast("Статус обновлён");
        });
      };
    });
  }

  // ---------- Настройки ----------
  function loadSettings() {
    panel().innerHTML = '<p class="loading">Загрузка…</p>';
    sb.from("settings").select("value").eq("key", "demo_orders_enabled").maybeSingle().then(function (r) {
      if (r.error) { panel().innerHTML = ""; return msg("Не удалось загрузить настройки."); }
      var on = !!(r.data && r.data.value === true);
      panel().innerHTML = '<div class="summary" style="max-width:520px"><h3>Тестовые заказы</h3>' +
        "<p>Сейчас оформление тестовых заказов <strong>" + (on ? "включено" : "выключено") + "</strong>.</p>" +
        '<p class="hint">Перед реальным запуском магазина тестовые заказы нужно выключить. Когда они выключены, посетители не смогут создать заказ.</p>' +
        '<button type="button" class="btn" id="toggle-demo">' + (on ? "Выключить тестовые заказы" : "Включить тестовые заказы") + "</button></div>";
      document.getElementById("toggle-demo").addEventListener("click", function () {
        sb.from("settings").update({ value: !on }).eq("key", "demo_orders_enabled").then(function (r2) {
          if (r2.error) return msg("Не удалось изменить настройку.");
          msg(""); loadSettings();
        });
      });
    });
  }
})();
