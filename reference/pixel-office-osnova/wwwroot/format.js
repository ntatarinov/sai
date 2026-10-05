'use strict';

/* Форматирование дат и времени — единое для учётной системы и Agent Office.
 *
 * Время показывается в часовом поясе организации, а не в поясе устройства, с
 * которого открыли страницу. Это не косметика: дата проведения документа —
 * учётный факт, привязанный к календарному дню организации. Если бухгалтер
 * проводит документ 30 сентября в 23:40 по Алматы, а руководитель открывает его
 * из Москвы, документ должен остаться в сентябре, а не переехать в предыдущий
 * день и в закрытый период.
 *
 * Момент времени хранится в UTC — так и должно быть. Пояс применяется только при
 * отображении.
 *
 * Название пояса задано по базе IANA, а не числовым смещением: Казахстан менял
 * смещение (сейчас Алматы — UTC+5), и зашитая «+6» устарела бы молча. По имени
 * пояса браузер берёт актуальное правило сам.
 *
 * Когда появится мультитенантность, эта константа станет настройкой тенанта:
 * Узбекистан сейчас тоже UTC+5, но совпадение смещений — не повод считать пояса
 * одним и тем же. */
const ORG_TIME_ZONE = 'Asia/Almaty';
const ORG_TIME_ZONE_LABEL = 'Алматы';

const _fmt = (opts) => new Intl.DateTimeFormat('ru-RU', { timeZone: ORG_TIME_ZONE, ...opts });

const _fmtDateTime = _fmt({ dateStyle: 'short', timeStyle: 'short' });
const _fmtDateTimeLong = _fmt({ dateStyle: 'long', timeStyle: 'short' });
const _fmtDate = _fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const _fmtTime = _fmt({ hour: '2-digit', minute: '2-digit' });

/** Дата и время: 20.09.26, 14:00 */
const fmtDateTime = v => v ? _fmtDateTime.format(new Date(v)) : '—';
/** Дата и время словами: 20 сентября 2026 г., 14:00 */
const fmtDateTimeLong = v => v ? _fmtDateTimeLong.format(new Date(v)) : '—';
/** Только дата: 20.09.2026 */
const fmtDate = v => v ? _fmtDate.format(new Date(v)) : '—';
/** Только время: 14:00 */
const fmtTime = v => v ? _fmtTime.format(new Date(v)) : '—';
