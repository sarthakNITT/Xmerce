"use client";

import { useEffect, useRef, useState } from "react";
import { orderConfig, orderService } from "./order-service";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-md border " +
  "border-[#cbd2c5] px-4 py-3 text-sm font-medium transition " +
  "hover:bg-[#e9eee3] focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-4 focus-visible:outline-[#244df2] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const primaryButton =
  `${button} border-transparent bg-[#244df2] text-white hover:bg-[#193bd0]`;

const panel = "rounded-xl border border-[#d9ddd5] bg-white/40 p-5 sm:p-7";

function amount(value, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function date(value, includeYear = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "To be confirmed";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function deliveryRange(start, end) {
  if (!start || !end) return "Delivery estimate coming soon";
  return `${date(start)} – ${date(end)}`;
}

function ProductImage({ src, name }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-3"
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 70"
      aria-hidden="true"
      className="h-16 w-20 fill-none stroke-[#62735d]"
      strokeWidth="1.5"
    >
      <rect x="15" y="8" width="70" height="46" rx="4" />
      <path d="M7 59h86l-6 5H13z" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Loading order"
      className="space-y-6 motion-safe:animate-pulse"
    >
      <div className="h-44 rounded-xl bg-[#e4e9df]" />
      <div className="h-20 rounded-xl bg-[#e4e9df]" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-52 rounded-xl bg-[#e4e9df]" />
        <div className="h-52 rounded-xl bg-[#e4e9df]" />
      </div>
      <span className="sr-only">Loading your order…</span>
    </div>
  );
}

export default function OrderConfirmation({
  orderNumber,
  service = orderService,
  demoVariant = "paid",

  // Your router can replace this callback.
  onPaymentFailed = (number) => {
    if (typeof window === "undefined") return;
    const target = new URL(orderConfig.routes.payment, window.location.origin);
    target.searchParams.set("orderNumber", number);
    target.searchParams.set("payment", "failed");
    window.location.replace(target.href);
  },
}) {
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [failedRedirect, setFailedRedirect] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cancellationDialog = useRef(null);
  const trackSection = useRef(null);
  const detailsSection = useRef(null);
  const failedHandler = useRef(onPaymentFailed);

  useEffect(() => {
    failedHandler.current = onPaymentFailed;
  }, [onPaymentFailed]);

  /*
   * Refresh performs GET only.
   * Recursive polling avoids overlapping requests.
   * A pending payment is polled every five seconds.
   * Polling stops on terminal payment state, cancellation or unmount.
   */
  useEffect(() => {
    let stopped = false;
    let timer;
    const controller = new AbortController();

    setLoading(true);
    setOrder(null);
    setError("");
    setNotice("");
    setFailedRedirect(false);

    async function read(isFirst = false) {
      let shouldPoll = !isFirst;

      try {
        if (!orderNumber) throw new Error("The order number is missing.");

        const next = await service.getOrder(orderNumber, {
          signal: controller.signal,
          demoVariant,
        });

        if (stopped) return;

        setOrder(next);
        setError("");
        setNotice("");

        if (next.payment.status === "FAILED") {
          setFailedRedirect(true);
          failedHandler.current(next.orderNumber);
          return;
        }

        shouldPoll =
          next.payment.status === "PENDING" &&
          next.status !== "CANCELLED";
      } catch (failure) {
        if (stopped || failure.name === "AbortError") return;

        if (isFirst) setError(failure.message);
        else {
          setNotice(
            "We could not refresh payment status. We’ll try again shortly.",
          );
        }
      } finally {
        if (!stopped) {
          setLoading(false);

          if (shouldPoll) {
            timer = window.setTimeout(
              () => read(false),
              orderConfig.pollInterval,
            );
          }
        }
      }
    }

    read(true);

    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [orderNumber, demoVariant, service, retry]);

  async function cancelOrder() {
    setActionBusy(true);
    setNotice("");

    try {
      const updated = await service.cancelOrder(orderNumber, { demoVariant });
      setOrder(updated);
      cancellationDialog.current?.close();
      setNotice(
        "Your order has been cancelled. Any refund information will come from the order service.",
      );
    } catch (failure) {
      cancellationDialog.current?.close();
      setNotice(failure.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function downloadInvoice() {
    setActionBusy(true);

    try {
      await service.downloadInvoice(orderNumber);
      setNotice("Invoice download started.");
    } catch (failure) {
      setNotice(failure.message);
    } finally {
      setActionBusy(false);
    }
  }

  function jumpTo(ref) {
    ref.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    ref.current?.focus({ preventScroll: true });
  }

  const cancelled = order?.status === "CANCELLED";
  const pending = order?.payment.status === "PENDING";
  const cod = order?.payment.status === "COD";
  const delivered = order?.status === "DELIVERED";

  const canCancel =
    order?.canCancel &&
    ["CONFIRMED", "PACKED"].includes(order.status) &&
    !pending &&
    !cancelled;

  const bannerTitle = cancelled
    ? "Your order has been cancelled."
    : pending
      ? "We’re confirming your payment."
      : cod
        ? "Order confirmed. Pay on delivery."
        : "It’s yours. Let’s get it to you.";

  return (
    <div className="order-conf-page min-h-screen bg-[#f7f7f2] font-sans text-[#18211f]">
      <header className="border-b border-[#d9ddd5]">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5">
          <a
            href="/"
            aria-label="NovaTech home"
            className="text-3xl font-extrabold tracking-[-0.08em]"
          >
            nova<span className="text-[#244df2]">tech</span>↗
          </a>

          <a href={orderConfig.routes.shop} className="py-3 text-sm">
            Continue shopping ↗
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <p className="mb-7 text-xs text-[#59625e]">
          Home / Orders / Confirmation
        </p>

        {!mounted || loading ? (
          <Skeleton />
        ) : error ? (
          <section className={panel} role="alert">
            <h1 className="text-2xl font-medium">Let’s try that again.</h1>
            <p className="my-4 text-[#59625e]">{error}</p>
            <button className={primaryButton} onClick={() => setRetry((n) => n + 1)}>
              Retry
            </button>
          </section>
        ) : failedRedirect ? (
          <section className={panel} role="status" aria-live="polite">
            <h1 className="text-2xl font-medium">Payment needs attention.</h1>
            <p className="mt-3">Taking you back to payment…</p>
          </section>
        ) : order ? (
          <div className="space-y-6">
            {/* 1. Confirmation / pending / cancellation banner */}
            <section
              aria-live="polite"
              aria-atomic="true"
              className={`rounded-xl p-7 sm:p-10 ${
                pending ? "bg-[#f3ead5]" : "bg-[#e6ecde]"
              }`}
            >
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em]">
                {cancelled
                  ? "Order update"
                  : pending
                    ? "Payment verification"
                    : "Thank you for choosing NovaTech"}
              </p>

              <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-tight sm:text-5xl">
                {bannerTitle}
              </h1>

              <p className="mt-4 max-w-2xl text-sm text-[#59625e]">
                {cancelled
                  ? "This order will no longer be prepared for delivery."
                  : pending
                    ? "You can keep this page open. We check the payment status every five seconds."
                    : "Your order details are below, ready whenever you need them."}
              </p>

              {order.demo && (
                <p className="mt-4 text-xs text-[#59625e]">
                  Frontend demo · sample customer and order · no payment or email sent.
                </p>
              )}
            </section>

            {/* 2. Order strip */}
            <section className={`${panel} grid gap-5 sm:grid-cols-3`}>
              <div>
                <p className="text-xs text-[#59625e]">Order number</p>
                <p className="mt-1 break-all font-mono text-sm">
                  {order.orderNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#59625e]">Placed on</p>
                <p className="mt-1 text-sm">{date(order.createdAt, true)}</p>
              </div>
              <div>
                <p className="text-xs text-[#59625e]">Contact email</p>
                <p className="mt-1 break-all text-sm">
                  {order.customer.maskedEmail}
                </p>
                {order.emailStatus === "QUEUED" && (
                  <p className="mt-1 text-xs text-[#59625e]">Confirmation email queued.</p>
                )}
                {order.emailStatus === "SENT" && (
                  <p className="mt-1 text-xs text-[#59625e]">Confirmation email sent.</p>
                )}
              </div>
            </section>

            {/* 3. Delivery estimate */}
            <section className={panel}>
              <p className="text-xs uppercase tracking-widest text-[#59625e]">
                {delivered ? "Delivery status" : "Estimated delivery"}
              </p>
              <h2 className="mt-2 text-2xl font-medium">
                {cancelled
                  ? "Delivery cancelled"
                  : delivered
                    ? "Delivered"
                    : pending
                      ? "Available after payment confirmation"
                      : deliveryRange(
                          order.delivery?.earliest,
                          order.delivery?.latest,
                        )}
              </h2>
              {!cancelled && !pending && (
                <p className="mt-2 text-sm text-[#59625e]">
                  {order.delivery?.method}
                </p>
              )}
            </section>

            {/* 4. Shipping address */}
            <section className={panel}>
              <h2 className="text-xl font-medium">Shipping to</h2>
              <address className="mt-4 break-words text-sm not-italic leading-7 text-[#59625e]">
                <strong className="text-[#18211f]">{order.address.recipient}</strong>
                <br />
                {order.address.line1}
                {order.address.line2 && <><br />{order.address.line2}</>}
                <br />
                {order.address.city}, {order.address.region} {order.address.postalCode}
                <br />
                {order.address.country}
              </address>
            </section>

            {/* 5. Items */}
            <section ref={detailsSection} tabIndex={-1} className={`${panel} scroll-mt-6`}>
              <h2 className="text-xl font-medium">Your order, in detail</h2>

              <div className="mt-3 divide-y divide-[#d9ddd5]">
                {order.items.map((item) => (
                  <article key={item.id} className="flex gap-4 py-6 sm:gap-6">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-[#e9ede3] sm:h-32 sm:w-36">
                      <ProductImage src={item.image} name={item.name} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-3">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="font-semibold">
                          {amount(item.lineTotal, order.currency)}
                        </p>
                      </div>

                      <p className="mt-2 text-xs leading-6 text-[#59625e]">
                        {item.specs}
                      </p>

                      <p className="mt-2 text-xs text-[#59625e]">
                        Qty {item.quantity} · {amount(item.unitPrice, order.currency)} each
                      </p>

                      <p className="mt-3 text-xs">
                        {cancelled
                          ? "Cancelled"
                          : delivered
                            ? "Delivered"
                            : pending
                              ? "ETA pending payment confirmation"
                              : `Expected ${deliveryRange(item.etaStart, item.etaEnd)}`}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* 6. Payment information */}
            <section className={panel}>
              <h2 className="text-xl font-medium">Payment</h2>
              <p className="mt-4 text-sm">
                {cod
                  ? "Cash on delivery"
                  : order.payment.method === "CARD"
                    ? `Card${/^\d{4}$/.test(order.payment.last4 || "") ? ` ending ${order.payment.last4}` : ""}`
                    : order.payment.method === "UPI"
                      ? "UPI"
                      : "Online payment"}
              </p>
              <p className="mt-2 text-xs text-[#59625e]">
                {cod ? "Payment due on delivery" : pending ? "Verification pending" : "Payment received"}
                {cancelled && " · Order cancelled"}
              </p>
            </section>

            {/* 7. Price breakdown — values come from the order snapshot */}
            <section className={panel}>
              <h2 className="text-xl font-medium">Price breakdown</h2>
              <dl className="mt-5 space-y-3 text-sm">
                {[
                  ["Subtotal", order.totals.subtotal],
                  ["Shipping", order.totals.shipping],
                  ["Discount", order.totals.discount],
                  ["Tax", order.totals.tax],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-[#59625e]">{label}</dt>
                    <dd>
                      {label === "Discount" && Number(value) > 0 ? "−" : ""}
                      {amount(value, order.currency)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-[#d9ddd5] pt-4 text-lg font-semibold">
                  <dt>{cod ? "Total due" : "Order total"}</dt>
                  <dd>{amount(order.totals.grandTotal, order.currency)}</dd>
                </div>
              </dl>
            </section>

            {/* 8. Actions */}
            <section aria-label="Order actions" className="flex flex-wrap gap-3">
              {!cancelled && (
                <button className={primaryButton} onClick={() => jumpTo(trackSection)}>
                  Track order ↗
                </button>
              )}
              <button className={button} onClick={() => jumpTo(detailsSection)}>
                Order details
              </button>
              <button
                className={button}
                disabled={!order.invoiceAvailable || actionBusy}
                title={!order.invoiceAvailable ? "Invoice service is not available for this order." : ""}
                onClick={downloadInvoice}
              >
                Download invoice
              </button>
              <a className={button} href={orderConfig.routes.shop}>
                Continue shopping
              </a>
              {canCancel && (
                <button
                  className={button}
                  disabled={actionBusy}
                  onClick={() => cancellationDialog.current?.showModal()}
                >
                  Cancel order
                </button>
              )}
            </section>

            <p role="status" aria-live="polite" className="text-sm text-[#59625e]">
              {notice}
            </p>

            {/* 9. Three-step timeline */}
            <section ref={trackSection} tabIndex={-1} className={`${panel} scroll-mt-6`}>
              <h2 className="text-xl font-medium">From our door to yours</h2>

              {cancelled ? (
                <p className="mt-5 text-sm text-[#59625e]">
                  Cancelled on {date(order.cancelledAt, true)}.
                </p>
              ) : (
                <ol className="mt-7 grid gap-6 sm:grid-cols-3">
                  {order.timeline.map((step, index) => {
                    const complete = Boolean(step.completedAt) && !pending;

                    return (
                      <li key={step.key} className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
                            complete
                              ? "bg-[#244df2] text-white"
                              : "border border-[#bdc7b6] text-[#59625e]"
                          }`}
                        >
                          {complete ? "✓" : index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{step.label}</p>
                          <p className="mt-1 text-xs text-[#59625e]">
                            {complete ? date(step.completedAt) : "Upcoming"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* 10. Recommendations */}
            {order.recommendations.length > 0 && (
              <section className="py-5">
                <p className="mb-2 text-xs uppercase tracking-widest text-[#59625e]">
                  Complete your setup
                </p>
                <h2 className="text-2xl font-medium tracking-tight">
                  {order.recommendationSource === "CO_PURCHASE"
                    ? "Customers also bought"
                    : "A little more for your setup"}
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {order.recommendations.map((product) => (
                    <a key={product.id} href={product.href} className={`${panel} block hover:bg-[#edf1e7]`}>
                      <div className="mb-4 flex h-28 items-center justify-center rounded-lg bg-[#e9ede3]">
                        <ProductImage src={product.image} name={product.name} />
                      </div>
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="mt-2 text-xs text-[#59625e]">{product.description}</p>
                      <p className="mt-4 text-sm font-semibold">
                        {amount(product.price, order.currency)} ↗
                      </p>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* 11. Support */}
            <section className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d9ddd5] py-6">
              <div>
                <h2 className="font-medium">We’re here after checkout, too.</h2>
                <p className="mt-1 text-xs text-[#59625e]">
                  Questions about delivery, returns or your warranty?
                </p>
              </div>
              <a className={button} href={orderConfig.routes.support}>
                Ask NovaTech ↗
              </a>
            </section>
          </div>
        ) : null}

        <dialog
          ref={cancellationDialog}
          aria-labelledby="cancel-title"
          onCancel={(event) => {
            if (actionBusy) event.preventDefault();
          }}
          className="w-[min(92vw,460px)] rounded-xl bg-[#f7f7f2] p-7 text-[#18211f] shadow-xl backdrop:bg-black/40"
        >
          <h2 id="cancel-title" className="text-2xl font-medium">Cancel this order?</h2>
          <p className="my-5 text-sm text-[#59625e]">
            We’ll ask the order service to cancel it. The service will verify
            whether it is still eligible.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={actionBusy}
              onClick={() => cancellationDialog.current?.close()}
              autoFocus
            >
              Keep order
            </button>
            <button
              className={primaryButton}
              disabled={actionBusy}
              onClick={cancelOrder}
            >
              {actionBusy ? "Cancelling…" : "Confirm cancellation"}
            </button>
          </div>
        </dialog>
      </main>
    </div>
  );
}
