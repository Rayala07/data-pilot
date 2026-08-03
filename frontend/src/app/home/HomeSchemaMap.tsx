"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Forty-seven table names; three of them lit, one after another.
 *
 * The claim beside this is "it finds the three that matter" — so the three
 * arriving in sequence *is* the claim, where three pre-highlighted chips were
 * just a picture of the result.
 *
 * Plays once, when it scrolls into view, and then stays lit. Deliberately not a
 * loop: the hero demo already loops, and two competing loops means the page
 * never settles. One-shot also means no pause control is owed — nothing here
 * repeats.
 *
 * Renders fully lit on the server, so no-JS and reduced-motion readers get the
 * finished state rather than a grid with nothing selected.
 */

const SCHEMA = [
  "acct_bal", "addr_book", "audit_log", "brand_ref", "cart_hdr", "cart_ln",
  "cat_map", "chan_attr", "cust_dim", "cust_pref", "disc_rule", "dlvr_slot",
  "evt_stream", "fx_rate", "gift_card", "inv_adj", "inv_snap", "kpi_daily",
  "loyalty_tx", "mkt_touch", "order_lines", "orders", "pay_auth", "pay_capt",
  "price_hist", "prod_attr", "prod_media", "products", "promo_code", "refund_hdr",
  "region_dim", "reorder_pt", "ret_reason", "rev_share", "ship_leg", "ship_rate",
  "sku_alias", "stock_bin", "supp_cont", "supp_dim", "tax_juris", "tax_rate",
  "tick_note", "usr_acct", "usr_sess", "wh_dim", "wish_ln",
];

/* Reading order, not relevance order. Lighting `orders` before `order_lines`
   would jump backwards up the grid and read as random rather than as a scan. */
const LIT = ["order_lines", "orders", "products"];

const LEAD_MS = 240;
const STEP_MS = 520;

export function HomeSchemaMap() {
  const [lit, setLit] = useState(LIT.length);
  const host = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect(); // one-shot; it should not re-run on every scroll past
        setLit(0);
        LIT.forEach((_, i) => {
          timers.current.push(setTimeout(() => setLit(i + 1), LEAD_MS + i * STEP_MS));
        });
      },
      { threshold: 0.35 }
    );

    io.observe(el);
    const pending = timers.current;
    return () => {
      io.disconnect();
      pending.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      ref={host}
      className="dp-schema"
      role="img"
      aria-label="A schema of 47 tables with orders, order_lines and products highlighted as the three retrieved for this question."
    >
      {SCHEMA.map((t) => {
        const rank = LIT.indexOf(t);
        const on = rank > -1 && rank < lit;
        return (
          <code key={t} className={`dp-schema__t${on ? " dp-schema__t--lit" : ""}`}>
            {t}
          </code>
        );
      })}
    </div>
  );
}
