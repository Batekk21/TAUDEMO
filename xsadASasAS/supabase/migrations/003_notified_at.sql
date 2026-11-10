-- Отметка "отчёт в Telegram уже отправлен", чтобы один заказ не давал несколько сообщений.
alter table public.orders add column if not exists notified_at timestamptz;
