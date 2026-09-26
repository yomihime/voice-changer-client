// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, React, useTranslation, CircularProgress, IconButton, Typography, Box, Dialog, DialogContent, FormControl, InputLabel, LinearProgress, MenuItem, Select, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog.js";
const ModelActions = ({
  model,
  isMoving,
  setIsMoving,
  isMovingTarget,
  onUploadClick,
  onSampleModelClick
}) => {
  const {
      t
    } = useTranslation(),
    T = model.slot_index,
    {
      deleteServerSlotInfo,
      moveModel,
      exportModel,
      exportToOnnx,
      moveExportedOnnxModel,
      triggerToast,
      serverSlotInfos
    } = useAppRoot(),
    [ae, se] = ReactRuntime.useState(false),
    [ce, fe] = ReactRuntime.useState(false),
    [pe, le] = ReactRuntime.useState(false),
    [de, he] = ReactRuntime.useState(null),
    [me, ye] = ReactRuntime.useState(0),
    be = React.useRef(0),
    ve = React.useRef(null),
    [xe, Ce] = ReactRuntime.useState(false),
    _e = model.voice_changer_type == "RVC" && model.is_onnx == false,
    Be = ReactRuntime.useMemo(() => serverSlotInfos.filter(Me => Me.voice_changer_type == null).map(Me => Me.slot_index).sort((Me, Ge) => Me - Ge), [serverSlotInfos]);
  React.useEffect(() => {
    ce && Be.length > 0 && he(Be[0]);
  }, [ce, Be]);
  const Ve = () => {
      ye(0);
      be.current = 0;
      let Me = 0;
      ve.current && clearInterval(ve.current);
      ve.current = setInterval(() => {
        Me += 0.3;
        let Ge = 0;
        Me < 59 ? Ge = Math.min(99, Me / 59 * 99) : Me < 60 ? Ge = 99 + (Me - 59) / 1 * 0.01 : (Ge = 100, ve.current && clearInterval(ve.current));
        be.current = Ge;
        ye(Ge);
      }, 300);
    },
    ke = () => {
      ve.current && clearInterval(ve.current);
      ye(100);
      be.current = 100;
    };
  React.useEffect(() => (ce ? ye(0) : ke(), () => {
    ve.current && clearInterval(ve.current);
  }), [ce]);
  const Le = ReactRuntime.useMemo(() => model.voice_changer_type == null ? null : jsxRuntime.jsx(IconButton, {
      onClick: Ge => {
        Ge.stopPropagation();
        setIsMoving(T);
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: isMoving === T ? "primary.main" : "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsx("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          children: jsxRuntime.jsx("path", {
            d: "M5 9l7-7 7 7M5 15l7 7 7-7"
          })
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t(isMoving === T ? "common.model_editor.moving" : "common.model_editor.move")
        })]
      })
    }), [isMoving, T, setIsMoving, t, model.voice_changer_type]),
    qe = ReactRuntime.useMemo(() => model.voice_changer_type == null ? null : jsxRuntime.jsx(IconButton, {
      onClick: async Ge => {
        Ge.stopPropagation();
        Ce(true);
        try {
          const er = await exportModel({
            slot_index: T
          });
          if (!er) return;
          const Ht = (model.name ? model.name : `model_${T}`) + ".zip",
            rr = window.URL.createObjectURL(er),
            Jt = document.createElement("a");
          Jt.href = rr;
          Jt.download = Ht;
          document.body.appendChild(Jt);
          Jt.click();
          document.body.removeChild(Jt);
          window.URL.revokeObjectURL(rr);
        } catch (er) {
          console.error(t("common.model_editor.download_failed"), er);
          triggerToast("error", t("common.model_editor.download_failed"));
        } finally {
          Ce(false);
        }
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      disabled: xe,
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsxs("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          children: [jsxRuntime.jsx("path", {
            d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
          }), jsxRuntime.jsx("polyline", {
            points: "7 10 12 15 17 10"
          }), jsxRuntime.jsx("line", {
            x1: "12",
            y1: "15",
            x2: "12",
            y2: "3"
          })]
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t("common.model_editor.download")
        })]
      })
    }), [model.voice_changer_type, T, t, model.name, exportModel, xe, triggerToast]),
    ze = ReactRuntime.useMemo(() => model.voice_changer_type == null ? null : jsxRuntime.jsx(IconButton, {
      onClick: Ge => {
        Ge.stopPropagation();
        se(true);
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsx("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          children: jsxRuntime.jsx("path", {
            d: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
          })
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t("common.model_editor.delete")
        })]
      })
    }), [model.voice_changer_type, t]),
    Ae = ReactRuntime.useMemo(() => model.voice_changer_type != null || isMovingTarget ? null : jsxRuntime.jsx(IconButton, {
      onClick: Ge => {
        Ge.stopPropagation();
        onUploadClick(T);
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: isMovingTarget ? "primary.main" : "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsxs("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          children: [jsxRuntime.jsx("path", {
            d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
          }), jsxRuntime.jsx("polyline", {
            points: "17 8 12 3 7 8"
          }), jsxRuntime.jsx("line", {
            x1: "12",
            y1: "3",
            x2: "12",
            y2: "15"
          })]
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t("common.model_editor.upload")
        })]
      })
    }), [model.voice_changer_type, isMovingTarget, T, t, onUploadClick]),
    Ne = ReactRuntime.useMemo(() => model.voice_changer_type != null || isMovingTarget == false ? null : jsxRuntime.jsx(IconButton, {
      onClick: Ge => {
        Ge.stopPropagation();
        isMoving != null && (moveModel(isMoving, T), setIsMoving(null));
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: isMovingTarget ? "primary.main" : "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsxs("svg", {
          width: "16",
          height: "16",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          children: [jsxRuntime.jsx("path", {
            d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
          }), jsxRuntime.jsx("polyline", {
            points: "17 8 12 3 7 8"
          }), jsxRuntime.jsx("line", {
            x1: "12",
            y1: "3",
            x2: "12",
            y2: "15"
          })]
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t("common.model_editor.move_here")
        })]
      })
    }), [model.voice_changer_type, isMovingTarget, isMoving, T, t, moveModel, setIsMoving]),
    We = ReactRuntime.useMemo(() => _e ? jsxRuntime.jsx(IconButton, {
      onClick: Ge => {
        Ge.stopPropagation();
        fe(true);
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      disabled: pe,
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsxs("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.5",
          children: [jsxRuntime.jsx("circle", {
            cx: "12",
            cy: "3",
            r: "1.2",
            fill: "currentColor"
          }), jsxRuntime.jsx("circle", {
            cx: "20",
            cy: "7",
            r: "1.2",
            fill: "currentColor"
          }), jsxRuntime.jsx("circle", {
            cx: "17",
            cy: "20",
            r: "1.2",
            fill: "currentColor"
          }), jsxRuntime.jsx("circle", {
            cx: "7",
            cy: "20",
            r: "1.2",
            fill: "currentColor"
          }), jsxRuntime.jsx("circle", {
            cx: "4",
            cy: "7",
            r: "1.2",
            fill: "currentColor"
          }), jsxRuntime.jsx("circle", {
            cx: "12",
            cy: "12",
            r: "1.2",
            fill: "currentColor"
          }), jsxRuntime.jsx("line", {
            x1: "12",
            y1: "3",
            x2: "20",
            y2: "7"
          }), jsxRuntime.jsx("line", {
            x1: "12",
            y1: "3",
            x2: "4",
            y2: "7"
          }), jsxRuntime.jsx("line", {
            x1: "12",
            y1: "3",
            x2: "12",
            y2: "12"
          }), jsxRuntime.jsx("line", {
            x1: "20",
            y1: "7",
            x2: "17",
            y2: "20"
          }), jsxRuntime.jsx("line", {
            x1: "20",
            y1: "7",
            x2: "12",
            y2: "12"
          }), jsxRuntime.jsx("line", {
            x1: "17",
            y1: "20",
            x2: "7",
            y2: "20"
          }), jsxRuntime.jsx("line", {
            x1: "17",
            y1: "20",
            x2: "12",
            y2: "12"
          }), jsxRuntime.jsx("line", {
            x1: "7",
            y1: "20",
            x2: "4",
            y2: "7"
          }), jsxRuntime.jsx("line", {
            x1: "7",
            y1: "20",
            x2: "12",
            y2: "12"
          }), jsxRuntime.jsx("line", {
            x1: "4",
            y1: "7",
            x2: "12",
            y2: "12"
          })]
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t("common.model_editor.generate_onnx")
        })]
      })
    }) : null, [_e, t, pe]),
    Ie = ReactRuntime.useMemo(() => model.voice_changer_type != null ? null : jsxRuntime.jsx(IconButton, {
      onClick: async Ge => {
        Ge.stopPropagation();
        onSampleModelClick(T);
      },
      color: "default",
      sx: {
        height: "43px",
        width: "160px",
        border: "2px solid",
        borderColor: "grey.300",
        borderRadius: "12px",
        "&:hover": {
          borderColor: "primary.main"
        }
      },
      children: jsxRuntime.jsxs(Stack, {
        direction: "row",
        spacing: 1,
        alignItems: "center",
        children: [jsxRuntime.jsxs("svg", {
          width: "20",
          height: "20",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          children: [jsxRuntime.jsx("rect", {
            x: "4",
            y: "3",
            width: "16",
            height: "18",
            rx: "2",
            stroke: "currentColor",
            strokeWidth: "1.5"
          }), jsxRuntime.jsx("path", {
            d: "M12 8v6",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round"
          }), jsxRuntime.jsx("polyline", {
            points: "9 13 12 16 15 13",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round"
          })]
        }), jsxRuntime.jsx("span", {
          style: {
            fontSize: "14px",
            whiteSpace: "nowrap"
          },
          children: t("common.model_editor.sample_model")
        })]
      })
    }), [model.voice_changer_type, t, T, onSampleModelClick]),
    $e = ReactRuntime.useMemo(() => jsxRuntime.jsxs("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flexShrink: 0
      },
      children: [Le, qe, ze, We, Ae, Ne, Ie]
    }), [ze, qe, Ne, Le, Ae, We, Ie]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [$e, jsxRuntime.jsx(ConfirmationDialog, {
      isOpen: ae,
      title: t("common.model_editor.delete_model"),
      message: t("common.model_editor.delete_confirm_message"),
      confirmButtonText: t("common.model_editor.delete"),
      cancelButtonText: t("common.model_editor.cancel"),
      onConfirm: async () => {
        await deleteServerSlotInfo(T);
        se(false);
      },
      onCancel: () => se(false)
    }), jsxRuntime.jsx(ConfirmationDialog, {
      isOpen: ce,
      title: t("common.model_editor.generate_onnx"),
      message: t("common.model_editor.generate_onnx_confirm_message"),
      confirmButtonText: t("common.model_editor.generate_onnx"),
      cancelButtonText: t("common.model_editor.cancel"),
      onConfirm: async () => {
        if (de != null) {
          le(true);
          Ve();
          try {
            await exportToOnnx({
              slot_index: T
            });
            await moveExportedOnnxModel(de);
            ke();
            triggerToast("success", t("common.model_editor.generate_onnx_success"));
          } catch {
            ke();
            triggerToast("error", t("common.model_editor.generate_onnx_failed"));
          } finally {
            le(false);
            fe(false);
          }
        }
      },
      onCancel: () => fe(false),
      messageExtra: jsxRuntime.jsxs(jsxRuntime.Fragment, {
        children: [jsxRuntime.jsxs(Box, {
          sx: {
            width: "100%",
            mt: 2
          },
          children: [jsxRuntime.jsx(LinearProgress, {
            variant: "determinate",
            value: me
          }), jsxRuntime.jsxs("div", {
            style: {
              textAlign: "right",
              fontSize: 12,
              marginTop: 4
            },
            children: [me.toFixed(2), "%"]
          })]
        }), Be.length > 0 ? jsxRuntime.jsxs(FormControl, {
          fullWidth: true,
          size: "small",
          sx: {
            mt: 2
          },
          children: [jsxRuntime.jsx(InputLabel, {
            id: "onnx-slot-select-label",
            children: t("common.model_editor.select_slot")
          }), jsxRuntime.jsx(Select, {
            labelId: "onnx-slot-select-label",
            value: de ?? "",
            label: t("common.model_editor.select_slot"),
            onChange: Me => he(Number(Me.target.value)),
            children: Be.map(Me => jsxRuntime.jsx(MenuItem, {
              value: Me,
              children: t("common.model_editor.slot", {
                number: Me + 1
              })
            }, Me))
          })]
        }) : jsxRuntime.jsx("div", {
          style: {
            color: "red",
            marginTop: 8
          },
          children: t("common.model_editor.no_empty_slot")
        })]
      })
    }), jsxRuntime.jsx(Dialog, {
      open: xe,
      PaperProps: {
        sx: {
          backgroundColor: "background.paper",
          padding: 2
        }
      },
      children: jsxRuntime.jsx(DialogContent, {
        children: jsxRuntime.jsxs(Stack, {
          spacing: 2,
          alignItems: "center",
          children: [jsxRuntime.jsx(CircularProgress, {}), jsxRuntime.jsx(Typography, {
            children: t("common.model_editor.downloading")
          }), jsxRuntime.jsx(IconButton, {
            onClick: () => Ce(false),
            sx: {
              position: "absolute",
              right: 8,
              top: 8
            },
            "aria-label": "close",
            children: jsxRuntime.jsxs("svg", {
              width: "24",
              height: "24",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              children: [jsxRuntime.jsx("line", {
                x1: "18",
                y1: "6",
                x2: "6",
                y2: "18"
              }), jsxRuntime.jsx("line", {
                x1: "6",
                y1: "6",
                x2: "18",
                y2: "18"
              })]
            })
          })]
        })
      })
    })]
  });
};
export { ModelActions as RightButtonArea };
