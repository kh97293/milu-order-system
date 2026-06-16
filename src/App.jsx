import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import React, { useMemo, useState } from "react";
import "./App.css";

const paymentFilters = [
  "全部",
  "待匯定",
  "等待確認",
  "未付款",
  "已匯款",
  "已貨付",
];

const CUSTOMER_SERVICE_LINK = "https://lin.ee/NQwZi4A";

const PAYMENT_REPORT_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbycG2dD6dKiPIkgG5ecUZGVZB3hPdBYFw55RYGiPNSVoi9bLf5zWajj97MfDo9SRFcAZw/exec";

export default function App() {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [orders, setOrders] = useState([]);
  const [mainFilter, setMainFilter] = useState("全部");
  const [paymentFilter, setPaymentFilter] = useState("全部");
  const [shippingFilter, setShippingFilter] = useState("全部");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showError, setShowError] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [lastFive, setLastFive] = useState("");
  const [isReportPressed, setIsReportPressed] = useState(false);

  const openCustomerService = () => {
    window.open(CUSTOMER_SERVICE_LINK, "_blank");
  };

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (mainFilter === "已登記")
      return list.filter((o) => o.phase === "已登記");
    if (mainFilter === "已完成") {
      return list.filter((o) => o.shippingStatus === "已取貨");
    }
    if (mainFilter === "已購入") {
      list = list.filter(
        (o) => o.phase === "已購入" && o.shippingStatus !== "已取貨"
      );
      if (paymentFilter !== "全部")
        list = list.filter((o) => o.paymentStatus === paymentFilter);
      if (shippingFilter !== "全部")
        list = list.filter((o) => o.shippingStatus === shippingFilter);
      return list;
    }
    return list;
  }, [orders, mainFilter, paymentFilter, shippingFilter]);

  const checkNickname = async () => {
    const keyword = nickname.trim();

    if (!keyword) {
      alert("請輸入社群暱稱");
      return;
    }

    try {
      const q = query(
        collection(db, "orders"),
        where("nickname", "==", keyword)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setShowError(true);
        return;
      }

      const result = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          groupName: data.groupName || "",
          phase: data.status || "",
          paymentStatus:
          data.paymentStatus === "已付款"
            ? "已匯款"
            : data.paymentStatus || "",
          shippingStatus: data.shippingStatus || "",
          itemCount: data.totalItems || 0,
          totalAmount: data.totalAmount || 0,
          items: data.items || [],
        };
      });

      setOrders(result);
      setStep(2);
    } catch (error) {
      console.error("查詢失敗：", error);

      alert("目前查詢系統忙碌中，請稍後再試，或聯絡客服協助查詢");
    }
  };
  const deposit = selectedOrder
    ? Math.floor(selectedOrder.totalAmount * 0.5)
    : 0;
  const finalPayment = selectedOrder ? selectedOrder.totalAmount - deposit : 0;

  const reportPayment = async () => {
    if (lastFive.length !== 5) {
      alert("請輸入匯款後五碼");
      return;
    }

    if (!selectedOrder) return;

    const paymentReport = `${nickname.trim()}付款完成
付款項目：${selectedOrder.groupName}
喊單總額：NT$ ${selectedOrder.totalAmount.toLocaleString()}
轉帳金額：NT$ ${deposit.toLocaleString()}
末五碼：${lastFive}`;

    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        paymentLastFive: lastFive,
        paymentReport,
        paymentReportStatus: "已通知匯款",
        paymentReportedAt: serverTimestamp(),
        paymentStatus: "等待確認",
      });

      await fetch(PAYMENT_REPORT_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          orderId: selectedOrder.id,
          nickname: nickname.trim(),
          groupName: selectedOrder.groupName,
          totalAmount: selectedOrder.totalAmount,
          transferAmount: deposit,
          lastFive,
        }),
      });

      setShowCodeModal(false);
      setStep(5);
    } catch (error) {
      alert("回報失敗，請稍後再試或聯絡客服");
      console.error(error);
    }
  };

  return (
    <div style={styles.page}>
      <main style={styles.panel}>
        <header style={styles.header}>
          <div style={styles.brand}>⋆✧*✩咪路麋鹿 動漫代購⋆✧*✩</div>
        </header>

        {step === 1 && (
          <>
            <div style={styles.heroImage}></div>

            <section style={styles.homeFormCard}>
              <h2 style={styles.title}>訂單查詢系統</h2>
              <p style={styles.helperText}>輸入社群暱稱，查詢您的訂單進度☁️</p>

              <input
                style={styles.input}
                placeholder="請輸入暱稱"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <button style={styles.primaryBtn} onClick={checkNickname}>
                🔎查詢我的訂單
              </button>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <button style={styles.backBtn} onClick={() => setStep(1)}>
              ← 返回
            </button>

            <section style={styles.filterCard}>
              <div style={styles.summaryRow}>
                <span style={styles.selectPill}>🧾 訂單篩選</span>
                <span style={styles.orderCount}>
                  共 {filteredOrders.length} 個訂單
                </span>
              </div>

              <div style={styles.mainTabs}>
                {["全部", "已登記", "已購入", "已完成"].map((filter) => (
                  <button
                    key={filter}
                    style={{
                      ...styles.filterTab,
                      ...(mainFilter === filter ? styles.filterTabActive : {}),
                    }}
                    onClick={() => {
                      setMainFilter(filter);
                      setPaymentFilter("全部");
                      setShippingFilter("全部");
                    }}
                  >
                    {filter === "全部"
                      ? "📂 全部"
                      : filter === "已登記"
                      ? "📑已登記"
                      : filter === "已購入"
                      ? "🛍️ 已購入"
                      : "✅ 已完成"}
                  </button>
                ))}
              </div>

              {mainFilter === "已購入" && (
                <div style={styles.filterGroups}>
                  <div style={styles.filterLabel}>💳 付款狀態</div>

                  <div style={styles.chipWrap}>
                    {paymentFilters.map((filter) => {
                      const active = paymentFilter === filter;

                      const paymentTabColors = {
                        全部: {
                          color: "#6b7280",
                          activeBg: "#bcc7d9",
                          activeColor: "#ffffff",
                        },

                        待匯定: {
                          color: "#b38b5e",
                          activeBg: "#e7c79f",
                          activeColor: "#ffffff",
                        },

                        等待確認: {
                          color: "#b77b63",
                          activeBg: "#e6b7a5",
                          activeColor: "#ffffff",
                        },

                        未付款: {
                          color: "#bc7474",
                          activeBg: "#e1a6a6",
                          activeColor: "#ffffff",
                        },

                        已匯款: {
                          color: "#6e9296",
                          activeBg: "#7fbec4",
                          activeColor: "#ffffff",
                        },

                        已貨付: {
                          color: "#8a78a5",
                          activeBg: "#c1b1de",
                          activeColor: "#ffffff",
                        },
                      };
                      const c = paymentTabColors[filter];

                      return (
                        <button
                          key={filter}
                          style={{
                            ...styles.chip,
                            background: active ? c.activeBg : "#fffdfa",
                            color: active ? c.activeColor : "#163f66",

                            border: "2px solid #163f66",
                            boxShadow: active
                              ? "0 4px 10px rgba(0,0,0,.12)"
                              : "2px 2px 0 rgba(22,63,102,.14)",
                          }}
                          onClick={() => setPaymentFilter(filter)}
                        >
                          {filter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
            {filteredOrders.length === 0 ? (
              <section style={styles.emptyCard}>
                <img
                  src="/deer-head.png"
                  alt="咪路麋鹿"
                  style={styles.emptyDeerImage}
                />
                <h3>沒有相關訂單</h3>
                <p>可以換個篩選條件看看唷☁️</p>
              </section>
            ) : (
              filteredOrders.map((order) => (
                <section
                  key={order.id}
                  style={styles.orderCard}
                  onClick={() => {
                    setSelectedOrder(order);
                    setStep(3);
                  }}
                >
                  <div style={styles.tags}>
                    <span style={styles.tagBlue}>
                      {order.phase === "已登記" ? "📑 已登記" : "🛍️ 已購入"}
                    </span>
                    {order.paymentStatus && (
                      <span style={styles.tagCream}>
                        💳 {order.paymentStatus}
                      </span>
                    )}
                    {order.shippingStatus && (
                      <span style={styles.tagCloud}>
                        📦 {order.shippingStatus}
                      </span>
                    )}
                  </div>

                  <h2 style={styles.orderTitle}>{order.groupName}</h2>

                  <div style={styles.orderFooter}>
                    <span style={styles.qty}>共 {order.itemCount} 件</span>
                    <div style={styles.totalBox}>
                      <span style={styles.totalLabel}>商品總額</span>
                      <strong style={styles.total}>
                        NT$ {order.totalAmount.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </section>
              ))
            )}
          </>
        )}

        {step === 3 && selectedOrder && (
          <section style={styles.card}>
            <button style={styles.backBtnSmall} onClick={() => setStep(2)}>
              ← 返回
            </button>

            {selectedOrder.phase === "已登記" ? (
              <>
                <div style={styles.detailHeader}>
                  <div style={styles.titleRow}>
                    <h2 style={styles.orderTitle}>{selectedOrder.groupName}</h2>
                    <div style={styles.noticeBoxWrap}>
  <div style={styles.noticeBox}>⏳ 等待官方通知</div>

  <div style={styles.noticeSubText}>
 未滿 NT$1000，通知下單
    <br />
    滿 NT$1000，通知匯款訂金
  </div>
</div>
                  </div>

                  <div style={styles.infoOne}>
                    <span>商品總金額</span>
                    <strong>
                      NT$ {selectedOrder.totalAmount.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div style={styles.detailBox}>
                  <h3 style={styles.sectionTitle}>購買商品明細🧾</h3>
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} style={styles.itemRow}>
                      <span>
                        {item.name} × {item.qty}
                      </span>
                      <span>
                        NT$ {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  style={styles.secondaryBtn}
                  onClick={openCustomerService}
                >
                  💬 聯絡客服
                </button>
              </>
            ) : (
              <>
                <div style={styles.tags}>
                  <span style={styles.tagBlue}>
                    {selectedOrder.phase === "已登記"
                      ? "📑 已登記"
                      : "🛍️ 已購入"}
                  </span>
                  <span style={styles.tagCream}>
                    💳 {selectedOrder.paymentStatus}
                  </span>
                  <span style={styles.tagCloud}>
                    📦 {selectedOrder.shippingStatus}
                  </span>
                </div>

                <h2 style={styles.orderTitle}>{selectedOrder.groupName}</h2>

                {selectedOrder.paymentStatus === "未付款" && (
                  <p style={styles.smallNotice}>
                    商品未滿NT1000元，等待麋鹿通知下單
                  </p>
                )}

                {selectedOrder.paymentStatus === "未付款" ? (
                  <div style={styles.infoGrid}>
                    <Info
                      label="商品總數"
                      value={`${selectedOrder.itemCount} 件`}
                    />
                    <Info
                      label="總金額"
                      value={`NT$ ${selectedOrder.totalAmount.toLocaleString()}`}
                    />
                  </div>
                ) : (
                  <div style={styles.infoGrid}>
                    <Info
                      label="商品總數"
                      value={`${selectedOrder.itemCount} 件`}
                    />
                    <Info
                      label="總金額"
                      value={`NT$ ${selectedOrder.totalAmount.toLocaleString()}`}
                    />

                    {selectedOrder.shippingStatus === "已取貨" ? (
                      <>
                        <Info label="商品狀態" value="已完成" />
                        <Info
                          label="已付總額"
                          value={`NT$ ${selectedOrder.totalAmount.toLocaleString()}`}
                        />
                      </>
                    ) : (
                      <>
                        <Info
                          label="應付訂金 50%"
                          value={`NT$ ${deposit.toLocaleString()}`}
                        />
                        <Info
                          label="應付尾款"
                          value={`NT$ ${finalPayment.toLocaleString()}`}
                        />
                      </>
                    )}
                  </div>
                )}

                <div style={styles.detailBox}>
                  <h3 style={styles.sectionTitle}>購買商品明細🧾</h3>
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} style={styles.itemRow}>
                      <span>
                        {item.name} × {item.qty}
                      </span>
                      <span>
                        NT$ {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {selectedOrder.paymentStatus === "待匯定" ? (
                  <button
                    style={styles.primaryBtn}
                    onClick={() => setShowPaymentModal(true)}
                  >
                    💳 點我付款
                  </button>
                ) : selectedOrder.paymentStatus === "等待確認" ? (
                  <button style={styles.waitingBtn}>⏳ 等待款項確認中</button>
                ) : (
                  <button
                    style={styles.secondaryBtn}
                    onClick={openCustomerService}
                  >
                    💬 聯絡客服
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {step === 5 && (
          <section style={styles.card}>
            <button style={styles.backBtnSmall} onClick={() => setStep(1)}>
              ← 返回首頁
            </button>
            <img
              src="/deer-head.png"
              alt="咪路麋鹿"
              style={styles.finalDeerImage}
            />
            <h2 style={styles.title}>完成回報</h2>
            <p style={styles.finalText}>
              感謝您的訂購與信任！！
              <br />
              期待商品到來 ☁️
            </p>
          </section>
        )}

        <footer style={styles.footer}>© 咪路麋鹿動漫代購｜訂單查詢系統</footer>
      </main>

      {showError && (
        <Modal>
          <h2 style={styles.modalTitle}>查無此暱稱</h2>
          <p style={styles.modalText}>請確認輸入之暱稱是否與社群回報吻合</p>
          <button style={styles.primaryBtn} onClick={() => setShowError(false)}>
            我知道了
          </button>
        </Modal>
      )}

      {showPaymentModal && selectedOrder && (
        <Modal>
          <h2 style={styles.modalTitle}>匯款資訊</h2>
          <div style={styles.paymentInfo}>
            <p style={styles.paymentNote}>轉帳請備註社群暱稱💌</p>
            <p style={styles.paymentExample}>例如：麋鹿 / 咖醬的狗</p>

            <p style={styles.paymentGroup}>🦌 可轉帳 / 無卡帳號 ↓</p>
            <div style={styles.bankBox}>
              <p style={styles.paymentLine}>台新（812）28881013405739</p>
              <p style={styles.paymentLine}>中信（822）193540210513</p>
              <p style={styles.paymentLine}>國泰（013）699508481385</p>
            </div>

            <p style={styles.paymentAmount}>
              需付款金額：NT$ {deposit.toLocaleString()}
            </p>
          </div>

          <button
            style={styles.primaryBtn}
            onClick={() => {
              setShowPaymentModal(false);
              setShowCodeModal(true);
            }}
          >
            確認，我已匯款
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => setShowPaymentModal(false)}
          >
            取消
          </button>
        </Modal>
      )}

      {showCodeModal && selectedOrder && (
        <Modal>
          <h2 style={styles.modalTitle}>輸入匯款後五碼</h2>

          <input
            style={styles.input}
            placeholder="請輸入 5 碼"
            value={lastFive}
            maxLength={5}
            onChange={(e) =>
              setLastFive(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
          />

          {lastFive.length === 5 && (
            <div style={styles.confirmBox}>
              <p>暱稱：{nickname}</p>
              <p>團務：{selectedOrder.groupName}</p>
              <p>後五碼：{lastFive}</p>
              <p>金額：NT$ {deposit.toLocaleString()}</p>
            </div>
          )}

          <button
            style={{
              ...styles.primaryBtn,
              ...(isReportPressed ? styles.primaryBtnPressed : {}),
            }}
            onTouchStart={() => setIsReportPressed(true)}
            onTouchEnd={() => setIsReportPressed(false)}
            onMouseDown={() => setIsReportPressed(true)}
            onMouseUp={() => setIsReportPressed(false)}
            onMouseLeave={() => setIsReportPressed(false)}
            onClick={reportPayment}
          >
            通知已匯款
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => setShowCodeModal(false)}
          >
            取消
          </button>
        </Modal>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

function Modal({ children }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>{children}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#dce9f7",
    padding: 0,
    fontFamily:
      '"jf open 粉圓", "Zen Maru Gothic", "Klee One", "LXGW WenKai TC", "Yuanti TC", "Microsoft JhengHei", sans-serif',
    color: "#163f66",
    backgroundImage:
      "radial-gradient(rgba(83,119,189,.16) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  },
  panel: {
    width: "100%",
    maxWidth: 1180,
    minHeight: "100dvh",
    margin: "0 auto",
    background: "#fff8ea",
    padding: "28px 36px 32px",
    borderLeft: "6px solid #5377bd",
    borderRight: "6px solid #5377bd",
    boxShadow: "0 12px 32px rgba(64,100,138,.12)",
    boxSizing: "border-box",
  },
  header: {
    textAlign: "center",
    padding: "6px 0 12px",
  },
  finalDeerImage: {
    width: 110,
    height: 110,
    objectFit: "contain",
    display: "block",
    margin: "0 auto 12px",
  },
  brand: {
    fontSize: 18,
    lineHeight: 1.35,
    fontWeight: 900,
    textAlign: "center",
    fontFamily:
      '"Arial Rounded MT Bold", "PingFang TC", "Noto Sans TC", sans-serif',
    letterSpacing: "0.5px",
  },
  heroImage: {
    width: "100%",
    maxWidth: 620,
    aspectRatio: "1 / 1",
    backgroundImage: "url('/icon.png')",
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    margin: "0 auto -40px",
  },
  homeFormCard: {
    width: "100%",
    maxWidth: 360,
    margin: "0 auto",
    background: "#fffdfa",
    padding: 20,
    border: "3px solid #163f66",
    boxShadow: "5px 5px 0 rgba(22,63,102,.24)",
    marginBottom: 0,
    position: "relative",
    zIndex: 2,
  },
  card: {
    background: "#fffdfa",
    padding: 20,
    border: "3px solid #163f66",
    boxShadow: "5px 5px 0 rgba(22,63,102,.24)",
    marginBottom: 18,
  },
  title: {
    textAlign: "center",
    fontSize: 25,
    margin: "6px 0 8px",
    fontWeight: 800,
  },
  helperText: {
    textAlign: "center",
    color: "#5b7896",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    height: 52,
    border: "2px solid #163f66",
    background: "#eef3f8",
    color: "#163f66",
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    outline: "none",
    borderRadius: 0,
    boxSizing: "border-box",
  },
  primaryBtn: {
    width: "100%",
    marginTop: 14,
    padding: "13px 12px",
    border: "2px solid #163f66",
    background: "#83bde8",
    color: "#163f66",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "4px 4px 0 rgba(22,63,102,.24)",
    transition: "transform .08s ease, box-shadow .08s ease, filter .08s ease",
  },
  primaryBtnPressed: {
    transform: "translateY(3px)",
    boxShadow: "1px 1px 0 rgba(22,63,102,.35)",
    filter: "brightness(0.94)",
  },
  waitingBtn: {
    width: "100%",
    marginTop: 14,
    padding: "10px 12px",
    border: "2px solid #163f66",
    background: "#fff8ea",
    color: "#163f66",
    fontSize: 14,
    fontWeight: 800,
    cursor: "default",
    fontFamily: "inherit",
    boxShadow: "3px 3px 0 rgba(22,63,102,.18)",
    pointerEvents: "none", // 完全不能點
  },
  secondaryBtn: {
    width: "100%",
    marginTop: 10,
    padding: "13px 12px",
    border: "2px solid #163f66",
    background: "#fff8ea",
    color: "#163f66",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "4px 4px 0 rgba(22,63,102,.20)",
  },
  backBtn: {
    border: "2px solid #163f66",
    background: "#fff8ea",
    color: "#163f66",
    fontWeight: 800,
    fontSize: 14,
    marginBottom: 12,
    padding: "7px 11px",
    cursor: "pointer",
    display: "block",
    marginRight: "auto",
  },
  backBtnSmall: {
    border: "2px solid #163f66",
    background: "#fff8ea",
    color: "#163f66",
    fontWeight: 800,
    fontSize: 12,
    marginBottom: 12,
    padding: "5px 9px",
    cursor: "pointer",
    display: "block",
    marginRight: "auto",
  },
  filterCard: {
    background: "#fffdfa",
    border: "3px solid #163f66",
    padding: 12,
    boxShadow: "5px 5px 0 rgba(22,63,102,.18)",
    marginBottom: 18,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#3d8fbf",
    fontWeight: 800,
    marginBottom: 12,
    gap: 8,
  },
  selectPill: {
    border: "2px solid #3d8fbf",
    padding: "4px 8px",
    background: "#eef6ff",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  orderCount: {
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  mainTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 7,
  },
  filterTab: {
    border: "2px solid #163f66",
    padding: "9px 5px",
    background: "#fffdfa",
    color: "#163f66",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "3px 3px 0 rgba(22,63,102,.20)",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  filterTabActive: {
    background: "#2f86d4",
    color: "#fff",
  },
  filterGroups: {
    marginTop: 12,
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: 10,
  },
  filterLabel: {
    color: "#163f66",
    fontWeight: 800,
    marginBottom: 8,
    fontSize: 13,
    textAlign: "left",
  },
  chipWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    background: "#fffdfa",
    border: "2px solid #163f66",
    color: "#163f66",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 8px",
    minHeight: 44,
    width: "100%",
    boxSizing: "border-box",
    boxShadow: "2px 2px 0 rgba(22,63,102,.14)",
  },

  chipActive: {
    background: "#2f86d4",
    color: "#fff",
  },
  orderCard: {
    background: "#fffdfa",
    border: "3px solid #163f66",
    padding: 16,
    minHeight: 160,
    boxShadow: "5px 5px 0 rgba(22,63,102,.18)",
    marginBottom: 18,
    cursor: "pointer",
  },
  tags: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  tagBlue: {
    background: "#2f86d4",
    color: "#fff",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #163f66",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  tagCream: {
    background: "#83bde8",
    color: "#163f66",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #163f66",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  tagCloud: {
    background: "#fff8ea",
    color: "#163f66",
    border: "1px solid #163f66",
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  },
  orderTitle: {
    fontSize: 18,
    lineHeight: 1.3,
    fontWeight: 800,
    margin: "10px 0 14px",
    textAlign: "left",
  },
  smallNotice: {
    marginTop: -8,
    marginBottom: 14,
    fontSize: 13,
    color: "#5b7896",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  orderFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  qty: {
    border: "2px solid #163f66",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 800,
    background: "#fffdfa",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  totalBox: {
    textAlign: "right",
    flex: 1,
  },
  totalLabel: {
    display: "block",
    fontWeight: 800,
    color: "#5b7896",
    fontSize: 12,
  },
  total: {
    color: "#8fb9ef",
    fontSize: 24,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  detailHeader: {
    borderBottom: "2px dashed #163f66",
    paddingBottom: 14,
    marginBottom: 14,
  },
  infoOne: {
    background: "#eef6ff",
    borderLeft: "5px solid #83bde8",
    padding: 13,
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 800,
    marginBottom: 12,
    fontSize: 14,
    gap: 10,
  },
  noticeBox: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    background: "#fff1c9",
    color: "#9b6b00",
  
    padding: "5px 10px",     
    fontWeight: 800,
    fontSize: 12,            
  
    borderRadius: 999,
    border: "2px dashed #f2b94b",
    boxShadow: "0 4px 10px rgba(242,185,75,.18)",
  
    marginTop: 0,
    marginBottom: 10,        
  
    whiteSpace: "nowrap",
  },
  noticeBoxWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  
  noticeSubText: {
    fontSize: 10,
    color: "#98a2ad",
    lineHeight: 1.2,
    fontWeight: 600,
    marginTop: -10,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
  },
  infoBox: {
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: "11px 10px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    gap: 5,
    fontWeight: 800,
    minHeight: 72,
    boxSizing: "border-box",
  },
  infoLabel: {
    fontSize: 12,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  infoValue: {
    fontSize: 13,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  detailBox: {
    marginTop: 14,
    background: "#fffdfa",
    borderTop: "2px dashed #163f66",
    padding: "14px 0 0",
  },
  sectionTitle: {
    margin: "0 0 12px",
    fontSize: 19,
    whiteSpace: "nowrap",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 0",
    borderBottom: "2px dashed #b8cee5",
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.35,
  },
  emptyCard: {
    background: "#fffdfa",
    border: "2px dashed #b8cee5",
    padding: 28,
    textAlign: "center",
    color: "#5b7896",
    fontWeight: 800,
  },
  emptyIcon: { fontSize: 36 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(22,63,102,.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 99,
  },
  modalBox: {
    width: 310,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "86vh",
    overflowY: "auto",
    background: "#fffdfa",
    border: "3px solid #163f66",
    padding: 18,
    boxShadow: "5px 5px 0 rgba(22,63,102,.24)",
    color: "#163f66",
    fontWeight: 700,
    boxSizing: "border-box",
  },
  modalTitle: {
    textAlign: "center",
    fontSize: 23,
    fontWeight: 800,
    margin: "4px 0 12px",
  },
  modalText: {
    textAlign: "center",
    lineHeight: 1.6,
    color: "#5b7896",
  },
  paymentInfo: {
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: "10px 11px",
    lineHeight: 1.35,
    fontSize: 13,
    textAlign: "center",
  },
  paymentNote: {
    margin: "4px 0 6px",
    lineHeight: 1.35,
    fontSize: 15,
    fontWeight: 900,
  },
  paymentExample: {
    margin: "2px 0 8px",
    lineHeight: 1.35,
    fontSize: 12,
    fontWeight: 800,
  },
  paymentLine: {
    textAlign: "left",
    fontSize: 14,
    marginBottom: 8,
    color: "#163f66",
    fontWeight: 700,
    whiteSpace: "pre",
  },

  bankBox: {
    width: "fit-content",
    margin: "0 auto",
  },

  bankName: {
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  bankAccount: {
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  paymentGroup: {
    fontSize: 15,
    fontWeight: 700,
    color: "#163f66",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  paymentAmount: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 900,
    color: "#163f66",
    textAlign: "center",
  },
  confirmBox: {
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: 13,
    marginTop: 14,
    fontSize: 14,
  },
  finalText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.8,
  },
  emptyDeerImage: {
    width: 72,
    height: 72,
    objectFit: "contain",
    display: "block",
    margin: "0 auto 12px",
  },
  footer: {
    textAlign: "center",
    marginTop: 22,
    fontSize: 12,
    fontWeight: 800,
    color: "#8c9fb8",
  },
};
