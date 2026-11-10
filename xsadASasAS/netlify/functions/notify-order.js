// Отправляет владельцу в личный Telegram отчёт о ТЕСТОВОМ заказе.
// Работает только на сервере Netlify. Секреты читаются из переменных окружения сайта:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// Пока любая из них не задана, функция ничего не отправляет.
// Заказ уже сохранён в базе ДО вызова этой функции; сбой Telegram заказ не удаляет.

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const money = (n) => Number(n).toLocaleString("ru-RU").replace(/\s/g, " ") + " ₸";
const clip = (s, n) => String(s == null ? "" : s).replace(/[\r\n]+/g, " ").slice(0, n);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Только POST" });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return json(200, { sent: false, reason: "Telegram не настроен" });
  }

  let number;
  try {
    number = JSON.parse(event.body || "{}").number;
  } catch (e) {
    return json(400, { error: "Неверный запрос" });
  }
  if (typeof number !== "string" || !/^DEMO-\d{3,}$/.test(number)) {
    return json(400, { error: "Неверный номер заказа" });
  }

  const base = SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/orders";
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
  };
  const filter = "number=eq." + encodeURIComponent(number) + "&is_demo=eq.true";

  try {
    // Один заказ — одно уведомление: "занимаем" заказ, пока notified_at пуст.
    const claim = await fetch(base + "?" + filter + "&notified_at=is.null&select=*,order_items(*)", {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ notified_at: new Date().toISOString() })
    });
    if (!claim.ok) return json(502, { sent: false, reason: "База недоступна" });
    const rows = await claim.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return json(200, { sent: false, reason: "Заказ не найден или отчёт уже отправлялся" });
    }
    const o = rows[0];

    const lines = (o.order_items || []).map(
      (i) => `${clip(i.product_name, 100)}, ${clip(i.color, 30)}, размер ${clip(i.size, 10)} — ${i.qty} шт.`
    );
    const text = [
      "ТЕСТОВЫЙ ЗАКАЗ — НЕ ОБРАБОТЫВАТЬ",
      "№ " + o.number,
      ...lines,
      "Город: " + clip(o.city, 100),
      "Адрес: " + clip(o.address, 200),
      "Покупатель: " + clip(o.customer_name, 100),
      "Сумма: " + money(o.total)
    ].join("\n");

    let tgOk = false;
    try {
      // Обычный текст без разметки: данные из формы не могут "сломать" сообщение.
      const tg = await fetch("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
      });
      tgOk = tg.ok;
    } catch (e) {
      tgOk = false;
    }

    if (!tgOk) {
      // Отпускаем заказ, чтобы можно было повторить. Сам заказ остаётся в базе.
      await fetch(base + "?" + filter, {
        method: "PATCH", headers, body: JSON.stringify({ notified_at: null })
      }).catch(() => {});
      return json(502, { sent: false, reason: "Telegram не принял сообщение" });
    }
    return json(200, { sent: true });
  } catch (e) {
    return json(502, { sent: false, reason: "Ошибка отправки" });
  }
};
