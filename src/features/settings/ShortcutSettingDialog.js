// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, Dialog, DialogContent } from "../../vendor/recovered-runtime.js";
import { useHotkey } from "../../state/hotkey-context.js";
const ShortcutSettingDialog = ({
  open,
  onClose
}) => {
  const {
      config,
      updateShortcut,
      setShorcutEnabled,
      checkDuplicationKey,
      hotKeySettingError
    } = useHotkey(),
    {
      t
    } = useTranslation(),
    [A, O] = ReactRuntime.useState(null),
    [H, ee] = ReactRuntime.useState(""),
    [te, ie] = ReactRuntime.useState(null),
    [ne, ae] = ReactRuntime.useState(null),
    [se, ce] = ReactRuntime.useState(false);
  ReactRuntime.useEffect(() => {
    A === null && ne !== null && (setShorcutEnabled(ne), ae(null));
  }, [A, ne, setShorcutEnabled]);
  const fe = ReactRuntime.useCallback(() => {
      O(null);
      ee("");
      ie(null);
      ce(false);
    }, []),
    pe = ReactRuntime.useCallback(async (ye, be) => {
      ye.preventDefault();
      ye.stopPropagation();
      const ve = [];
      ye.shiftKey && ve.push("shift");
      ye.ctrlKey && ve.push("control");
      ye.altKey && ve.push("alt");
      ye.metaKey && ve.push("meta");
      const xe = ye.key;
      let Ce = false;
      if (xe !== "Control" && xe !== "Alt" && xe !== "Shift" && xe !== "Meta") {
        if (xe === " ") ve.push("Space");else if (xe === "Enter") ve.push("Enter");else if (xe === "Tab") ve.push("Tab");else if (xe === "Escape") {
          fe();
          return;
        } else if (xe === "Backspace") ve.push("Backspace");else if (xe === "Delete") ve.push("Delete");else if (xe === "ArrowUp") ve.push("ArrowUp");else if (xe === "ArrowDown") ve.push("ArrowDown");else if (xe === "ArrowLeft") ve.push("ArrowLeft");else if (xe === "ArrowRight") ve.push("ArrowRight");else if (xe.startsWith("F") && xe.length > 1) ve.push(xe);else if (xe.length === 1) {
          const _e = xe.toUpperCase();
          _e.match(/[A-Z]/) ? ve.push(`Key${_e}`) : _e.match(/[0-9]/) ? ve.push(`Digit${_e}`) : ve.push(xe);
        } else ve.push(xe);
      } else Ce = true;
      if (console.log("🎯 duplicateError:11", ve), ve.length > 0) {
        const _e = ve.join("+");
        if (ee(_e), !Ce && config) {
          const Be = checkDuplicationKey(be, _e);
          Be ? ie(Be) : (await updateShortcut(be, _e), fe());
        }
      }
    }, [config, updateShortcut, checkDuplicationKey, fe]),
    le = ReactRuntime.useCallback(() => {
      fe();
    }, [fe]),
    de = ReactRuntime.useCallback((ye, be) => {
      config && ne === null && (ae(config.enabled), setShorcutEnabled(false));
      O(ye);
      ee(be);
      ie(null);
      ce(true);
    }, [config, ne, setShorcutEnabled]),
    he = ReactRuntime.useCallback(() => {
      A !== null && fe();
      onClose();
    }, [A, fe, onClose]);
  return ReactRuntime.useMemo(() => config ? jsxRuntime.jsxs(Dialog, {
    open,
    onClose: he,
    maxWidth: "md",
    fullWidth: true,
    children: [jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        padding: "20px 20px 0"
      },
      children: [jsxRuntime.jsx("h2", {
        style: {
          margin: 0
        },
        children: t("common.shortcut_settings.title")
      }), jsxRuntime.jsx("button", {
        onClick: he,
        style: {
          border: "none",
          background: "none",
          fontSize: "24px",
          cursor: "pointer",
          padding: "0 8px"
        },
        children: "×"
      })]
    }), jsxRuntime.jsx(DialogContent, {
      children: jsxRuntime.jsxs("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          padding: "20px 0"
        },
        children: [hotKeySettingError && jsxRuntime.jsx("div", {
          style: {
            color: "red",
            fontSize: "14px",
            marginBottom: "16px"
          },
          children: hotKeySettingError
        }), jsxRuntime.jsxs("div", {
          children: [jsxRuntime.jsxs("label", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: se ? 0.5 : 1,
              pointerEvents: se ? "none" : "auto"
            },
            children: [jsxRuntime.jsx("input", {
              type: "checkbox",
              checked: se ? ne ?? config.enabled : config.enabled,
              onChange: ye => {
                se || setShorcutEnabled(ye.target.checked);
              },
              disabled: se
            }), t("common.shortcut_settings_dialog.enable_shortcuts")]
          }), se && jsxRuntime.jsx("div", {
            style: {
              marginTop: "8px",
              padding: "8px 12px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffeaa7",
              borderRadius: "4px",
              fontSize: "12px",
              color: "#856404"
            },
            children: t("common.shortcut_settings.shortcuts_disabled_notice")
          })]
        }), jsxRuntime.jsxs("div", {
          children: [jsxRuntime.jsx("div", {
            style: {
              fontWeight: "bold",
              marginBottom: "16px"
            },
            children: t("common.shortcut_settings_dialog.shortcut_settings")
          }), jsxRuntime.jsx("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            },
            children: config.shortcuts.map(ye => jsxRuntime.jsxs("div", {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px",
                border: "1px solid #e0e0e0",
                borderRadius: "4px"
              },
              children: [jsxRuntime.jsxs("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "16px"
                },
                children: [jsxRuntime.jsxs("div", {
                  style: {
                    flex: "1"
                  },
                  children: [jsxRuntime.jsx("div", {
                    style: {
                      fontWeight: "bold",
                      marginBottom: "4px"
                    },
                    children: t(ye.display_name)
                  }), jsxRuntime.jsx("div", {
                    style: {
                      fontSize: "12px",
                      color: "#666"
                    },
                    children: t(ye.description)
                  })]
                }), jsxRuntime.jsx("div", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: "250px"
                  },
                  children: A === ye.action ? jsxRuntime.jsxs(jsxRuntime.Fragment, {
                    children: [jsxRuntime.jsx("input", {
                      type: "text",
                      value: H,
                      onKeyDown: be => pe(be, ye.action),
                      placeholder: t("common.shortcut_settings_dialog.press_key_placeholder"),
                      style: {
                        flex: 1,
                        padding: "6px 12px",
                        border: "2px solid #2196F3",
                        borderRadius: "4px",
                        fontSize: "14px",
                        outline: "none"
                      },
                      autoFocus: true,
                      readOnly: true
                    }), jsxRuntime.jsx("button", {
                      onClick: le,
                      style: {
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                      },
                      title: t("common.shortcut_settings.cancel_tooltip"),
                      children: "×"
                    })]
                  }) : jsxRuntime.jsx("div", {
                    onClick: () => de(ye.action, ye.shortcut),
                    style: {
                      flex: 1,
                      padding: "6px 12px",
                      backgroundColor: "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      minHeight: "20px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    },
                    onMouseEnter: be => {
                      be.currentTarget.style.backgroundColor = "#e8e8e8";
                      be.currentTarget.style.borderColor = "#bbb";
                    },
                    onMouseLeave: be => {
                      be.currentTarget.style.backgroundColor = "#f5f5f5";
                      be.currentTarget.style.borderColor = "#ddd";
                    },
                    title: t("common.shortcut_settings_dialog.click_to_edit"),
                    children: ye.shortcut || t("common.shortcut_settings_dialog.not_set")
                  })
                })]
              }), A === ye.action && te && jsxRuntime.jsx("div", {
                style: {
                  color: "#f44336",
                  fontSize: "12px",
                  marginTop: "4px",
                  paddingLeft: "8px",
                  backgroundColor: "#ffebee",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ffcdd2"
                },
                children: te
              })]
            }, ye.action))
          })]
        }), jsxRuntime.jsxs("div", {
          style: {
            marginTop: "20px",
            padding: "16px",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px"
          },
          children: [jsxRuntime.jsx("div", {
            style: {
              fontWeight: "bold",
              marginBottom: "8px"
            },
            children: t("common.shortcut_settings.usage_instructions.title")
          }), jsxRuntime.jsxs("div", {
            style: {
              fontSize: "14px",
              lineHeight: "1.5"
            },
            children: [jsxRuntime.jsx("div", {
              children: t("common.shortcut_settings.usage_instructions.instruction1")
            }), jsxRuntime.jsx("div", {
              children: t("common.shortcut_settings.usage_instructions.instruction2")
            }), jsxRuntime.jsx("div", {
              children: t("common.shortcut_settings.usage_instructions.instruction3")
            }), jsxRuntime.jsx("div", {
              children: t("common.shortcut_settings.usage_instructions.instruction4")
            }), jsxRuntime.jsx("div", {
              children: t("common.shortcut_settings_dialog.enable_shortcut_checkbox")
            }), jsxRuntime.jsx("div", {
              style: {
                marginTop: "8px",
                fontSize: "12px",
                color: "#666"
              },
              children: t("common.shortcut_settings_dialog.example")
            })]
          })]
        })]
      })
    })]
  }) : jsxRuntime.jsxs(Dialog, {
    open,
    onClose: he,
    maxWidth: "sm",
    fullWidth: true,
    children: [jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        padding: "20px 20px 0"
      },
      children: [jsxRuntime.jsx("h2", {
        style: {
          margin: 0
        },
        children: t("common.shortcut_settings.title")
      }), jsxRuntime.jsx("button", {
        onClick: he,
        style: {
          border: "none",
          background: "none",
          fontSize: "24px",
          cursor: "pointer",
          padding: "0 8px"
        },
        children: "×"
      })]
    }), jsxRuntime.jsx(DialogContent, {
      children: jsxRuntime.jsx("div", {
        style: {
          padding: "20px",
          textAlign: "center"
        },
        children: t("common.shortcut_settings_dialog.loading")
      })
    })]
  }), [open, he, config, hotKeySettingError, A, H, te, se, ne, pe, le, de, setShorcutEnabled, t]);
};
export { ShortcutSettingDialog };
