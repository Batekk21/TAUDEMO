// Настройки подключения к Supabase.
// Сюда можно вписать ТОЛЬКО два публичных значения из Supabase (Project Settings → API):
//   SUPABASE_URL      — адрес проекта (https://....supabase.co)
//   SUPABASE_ANON_KEY — публичный ключ: "anon public" или "publishable".
// Защиту данных обеспечивают правила RLS в базе, а не секретность этого ключа.
//
// КАТЕГОРИЧЕСКИ НЕЛЬЗЯ вписывать сюда service_role или secret ключ, пароль базы,
// токен Telegram. Они дают полный доступ и не должны попадать в браузер и GitHub.
//
// Пока значения пустые, сайт работает в демо-режиме на встроенных товарах.
window.TAU_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
