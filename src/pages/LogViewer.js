// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Switch, Tooltip } from "../vendor/recovered-runtime.js";
import { useAppRoot } from "../state/app-root-context.js";
import { log$1 as logMessage } from "../shared/logger.js";
const codeFilename$6 = import.meta.url.split("/").pop();
const logPrefix$6 = `[${codeFilename$6}]`;
const LogViewer = () => {
  const {
      t
    } = useTranslation(),
    {
      setUnhandledRejectionToastEnabled
    } = useAppRoot(),
    [isAutoRefreshEnabled, setAutoRefreshEnabledState] = ReactRuntime.useState(true),
    autoRefreshEnabledRef = ReactRuntime.useRef(isAutoRefreshEnabled),
    setAutoRefreshEnabled = ie => {
      autoRefreshEnabledRef.current = ie;
      setAutoRefreshEnabledState(ie);
    },
    [logText, setLogText] = ReactRuntime.useState(""),
    [visibleLineLimit, setVisibleLineLimit] = ReactRuntime.useState(1e3),
    logEndRef = ReactRuntime.useRef(null),
    lineCount = ReactRuntime.useMemo(() => logText ? logText.split(`
`).filter(ie => ie).length : 0, [logText]);
  ReactRuntime.useEffect(() => {
    setUnhandledRejectionToastEnabled(false);
  }, [setUnhandledRejectionToastEnabled]);
  ReactRuntime.useEffect(() => {
    const ie = ne => {
      ne.ctrlKey && ne.key === "r" && (ne.preventDefault(), setAutoRefreshEnabled(!autoRefreshEnabledRef.current));
    };
    return window.addEventListener("keydown", ie), () => {
      window.removeEventListener("keydown", ie);
    };
  }, []);
  ReactRuntime.useEffect(() => {
    let ie;
    const ne = () => {
      autoRefreshEnabledRef.current ? fetch("/vcclient.log").then(ae => ae.text()).then(ae => setLogText(ae)) : logMessage("info", logPrefix$6, "skip fetch");
      ie = window.setTimeout(ne, 1e3);
    };
    return ne(), () => window.clearTimeout(ie);
  }, []);
  const logRows = ReactRuntime.useMemo(() => {
    const ne = logText.split(`
`).map((he, me) => {
        const ye = he.split(" - ");
        let be = "",
          ve = "",
          xe = "",
          Ce = "",
          _e = "",
          Be = "",
          Ve = "";
        if (ye.length < 6) _e = he;else {
          be = ye[0].split(",")[0];
          ve = ye[1];
          xe = ye[2];
          Ce = ye[3];
          const ke = ye[ye.length - 2];
          Be = ke ? (qe => {
            const ze = qe.split(/[/\\]/),
              Ae = ze.pop(),
              Ne = ze.pop() || "";
            return qe?.includes(".venv") ? `(venv)${Ne}/${Ae}` : `${Ne}/${Ae}`;
          })(ke) : "";
          Ve = ye[ye.length - 1];
          _e = ye.slice(4, ye.length - 2).join(" - ");
        }
        return [me, be, ve, xe, Ce, _e, Be, Ve];
      }).slice(-visibleLineLimit),
      ae = ["ERROR", "Error", "error"],
      se = ["WARNING", "Warning", "warning"],
      ce = ["GPU[cuda]"],
      fe = ae.concat(se).concat(ce),
      pe = he => he.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1"),
      le = fe.map(pe);
    return jsxRuntime.jsx("div", {
      style: {
        userSelect: "text"
      },
      children: ne.map((he, me) => {
        const ve = he[5].split(new RegExp(`(${le.join("|")})`)).map((xe, Ce) => ae.includes(xe) ? jsxRuntime.jsx("span", {
          style: {
            color: "red"
          },
          children: xe
        }, Ce) : se.includes(xe) ? jsxRuntime.jsx("span", {
          style: {
            color: "blue"
          },
          children: xe
        }, Ce) : ce.includes(xe) ? jsxRuntime.jsx("span", {
          style: {
            color: "green"
          },
          children: xe
        }, Ce) : jsxRuntime.jsx("span", {
          children: xe
        }, Ce));
        return jsxRuntime.jsxs("div", {
          style: {
            backgroundColor: me % 2 == 0 ? "white" : "#eeeeee",
            display: "flex",
            gap: "20px"
          },
          children: [jsxRuntime.jsx("div", {
            style: {
              width: "250px",
              display: "flex",
              flexDirection: "column"
            },
            children: jsxRuntime.jsx(Tooltip, {
              title: `${he[6]} ${he[7]}`,
              enterDelay: 50,
              slotProps: {
                tooltip: {
                  style: {
                    fontSize: "22px",
                    fontWeight: "normal"
                  }
                }
              },
              children: jsxRuntime.jsxs("div", {
                children: [he[0], " | ", he[1]]
              })
            })
          }), jsxRuntime.jsx("div", {
            style: {
              width: "60px",
              color: he[4] === "ERROR" ? "red" : he[4] === "WARNING" ? "blue" : "black"
            },
            children: he[4]
          }), jsxRuntime.jsx("div", {
            style: {
              width: "500px"
            },
            children: ve
          })]
        });
      })
    });
  }, [logText, visibleLineLimit]);
  return ReactRuntime.useEffect(() => {
    logText && logEndRef.current && logEndRef.current.scrollIntoView({
      behavior: "smooth"
    });
  }, [logText]), jsxRuntime.jsxs("div", {
    style: {
      margin: "0 auto",
      padding: "20px",
      width: "100%"
    },
    children: [jsxRuntime.jsx("h2", {
      children: t("log_viewer.title")
    }), jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px"
      },
      children: [jsxRuntime.jsxs("label", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "4px"
        },
        children: [t("log_viewer.latest"), jsxRuntime.jsxs("select", {
          value: visibleLineLimit,
          onChange: ie => setVisibleLineLimit(Number(ie.target.value)),
          style: {
            margin: "0 4px"
          },
          children: [jsxRuntime.jsx("option", {
            value: 10,
            children: "10"
          }), jsxRuntime.jsx("option", {
            value: 50,
            children: "50"
          }), jsxRuntime.jsx("option", {
            value: 100,
            children: "100"
          }), jsxRuntime.jsx("option", {
            value: 500,
            children: "500"
          }), jsxRuntime.jsx("option", {
            value: 1e3,
            children: "1000"
          }), jsxRuntime.jsx("option", {
            value: 5e3,
            children: "5000"
          }), jsxRuntime.jsx("option", {
            value: 1e4,
            children: "10000"
          }), jsxRuntime.jsx("option", {
            value: lineCount,
            children: t("log_viewer.all_items", {
              count: lineCount
            })
          })]
        }), t("log_viewer.items"), jsxRuntime.jsxs("span", {
          style: {
            marginLeft: "8px",
            color: "#888"
          },
          children: ["/ ", t("log_viewer.total_items", {
            count: lineCount
          })]
        })]
      }), " ", jsxRuntime.jsxs("label", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "4px"
        },
        children: [jsxRuntime.jsx(Switch, {
          checked: isAutoRefreshEnabled,
          onChange: () => {
            logMessage("info", logPrefix$6, `${isAutoRefreshEnabled} -> ${!isAutoRefreshEnabled}`);
            setAutoRefreshEnabled(!isAutoRefreshEnabled);
          }
        }), t("log_viewer.autoload", {
          status: t(isAutoRefreshEnabled ? "log_viewer.on" : "log_viewer.off")
        })]
      })]
    }), logText ? jsxRuntime.jsxs("div", {
      style: {
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
        border: "1px solid #ccc",
        borderRadius: "4px",
        marginTop: "8px"
      },
      children: [logRows, jsxRuntime.jsx("div", {
        ref: logEndRef
      })]
    }) : jsxRuntime.jsx("div", {
      children: t("log_viewer.loading")
    })]
  });
};
export { LogViewer };
