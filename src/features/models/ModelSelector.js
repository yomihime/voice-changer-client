// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme, Tooltip, IconButton, Box, Pagination, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { MAX_SLOT_INDEX } from "../../domain/constants.js";
import { ModelUploadDialog } from "./ModelUploadDialog.js";
import { ModelEditDialog } from "./ModelEditDialog.js";
const ModelSelector = () => {
  const [isModelEditorOpen, setModelEditorOpen] = ReactRuntime.useState(false),
    [isUploadDialogOpen, setUploadDialogOpen] = ReactRuntime.useState(false),
    [uploadSlotIndex, setUploadSlotIndex] = ReactRuntime.useState(null),
    [currentPage, setCurrentPage] = ReactRuntime.useState(1),
    [modelsPerPage, setModelsPerPage] = ReactRuntime.useState(5),
    modelCardWidth = 120,
    modelCardGap = 15,
    {
      serverSlotInfos,
      currentSlotInfo,
      updateServerConfiguration,
      serverConfiguration
    } = useAppRoot(),
    theme = useTheme(),
    {
      t
    } = useTranslation(),
    availableModels = ReactRuntime.useMemo(() => serverSlotInfos.filter(be => be.voice_changer_type !== null) || [], [serverSlotInfos]);
  ReactRuntime.useEffect(() => {
    const be = () => {
      const ve = document.getElementById("model-card-row"),
        xe = ve ? ve.offsetWidth : window.innerWidth - 250,
        Ce = Math.max(1, Math.floor((xe + modelCardGap) / (modelCardWidth + modelCardGap)));
      setModelsPerPage(Ce);
    };
    return be(), window.addEventListener("resize", be), () => window.removeEventListener("resize", be);
  }, []);
  ReactRuntime.useEffect(() => {
    if (!currentSlotInfo) {
      setCurrentPage(1);
      return;
    }
    const be = availableModels.findIndex(Ce => Ce.slot_index === currentSlotInfo.slot_index);
    if (be === -1) {
      setCurrentPage(1);
      return;
    }
    const ve = Math.floor(be / modelsPerPage) + 1,
      xe = Math.max(1, Math.ceil(availableModels.length / modelsPerPage));
    setCurrentPage(Math.min(ve, xe));
  }, [modelsPerPage, availableModels, currentSlotInfo]);
  const visibleModels = ReactRuntime.useMemo(() => {
      const be = (currentPage - 1) * modelsPerPage;
      return availableModels.slice(be, be + modelsPerPage);
    }, [availableModels, currentPage, modelsPerPage]),
    pageCount = ReactRuntime.useMemo(() => Math.max(1, Math.ceil(availableModels.length / modelsPerPage)), [availableModels.length, modelsPerPage]),
    selectModel = ReactRuntime.useCallback(be => {
      console.log("slotId", be);
      serverConfiguration.current_slot_index = be;
      updateServerConfiguration(serverConfiguration);
    }, [serverConfiguration, updateServerConfiguration]),
    openUploadDialogForEmptySlot = ReactRuntime.useCallback(() => {
      const be = serverSlotInfos.filter(xe => xe.voice_changer_type !== null).map(xe => xe.slot_index);
      let ve = null;
      for (let xe = 0; xe < MAX_SLOT_INDEX; xe++) if (!be.includes(xe)) {
        ve = xe;
        break;
      }
      ve !== null ? (setUploadSlotIndex(ve), setUploadDialogOpen(true)) : alert(t("common.model_editor.no_empty_slot"));
    }, [serverSlotInfos, setUploadSlotIndex, setUploadDialogOpen, t]),
    modelCards = ReactRuntime.useMemo(() => visibleModels.map(be => {
      const ve = be.icon_file ? "model_dir/" + be.slot_index + "/" + be.icon_file.split(/[/\\]/).pop() : "./assets/icons/human.png",
        xe = `${be.slot_index + 1}.${be.name}`;
      return jsxRuntime.jsxs("div", {
        onClick: () => selectModel(be.slot_index),
        style: {
          position: "relative",
          cursor: "pointer",
          borderRadius: "8px",
          overflow: "hidden",
          border: `2px solid ${currentSlotInfo?.slot_index === be.slot_index ? theme.palette.primary.main : "transparent"}`,
          transition: "all 0.2s ease",
          width: "120px",
          height: "160px",
          display: "flex",
          flexDirection: "column",
          background: theme.palette.background.paper
        },
        children: [jsxRuntime.jsx("div", {
          style: {
            width: "100%",
            height: "120px",
            position: "relative",
            backgroundColor: theme.palette.mode === "light" ? "#f0f2f5" : theme.palette.background.default
          },
          children: be.icon_file ? jsxRuntime.jsx("img", {
            src: ve,
            alt: be.name || "",
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }
          }) : jsxRuntime.jsx("div", {
            style: {
              position: "absolute",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: "bold",
              color: theme.palette.text.secondary
            },
            children: be.name?.charAt(0).toUpperCase()
          })
        }), jsxRuntime.jsx("div", {
          style: {
            padding: "8px 4px 0 4px",
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`,
            height: "40px",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: jsxRuntime.jsx(Tooltip, {
            title: xe,
            placement: "top",
            arrow: true,
            children: jsxRuntime.jsx("div", {
              style: {
                fontWeight: "bold",
                fontSize: "13px",
                color: theme.palette.text.primary,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%"
              },
              children: xe
            })
          })
        })]
      }, be.slot_index);
    }), [visibleModels, theme, selectModel, currentSlotInfo]);
  return ReactRuntime.useMemo(() => jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsxs("div", {
      style: {
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: theme.palette.background.paper,
        marginBottom: "20px"
      },
      children: [jsxRuntime.jsxs("div", {
        style: {
          padding: "15px",
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.mode === "light" ? "#fafafa" : theme.palette.background.default,
          fontWeight: "bold",
          fontSize: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        },
        children: [jsxRuntime.jsx("span", {
          children: t("common.model.list_title")
        }), jsxRuntime.jsxs("span", {
          style: {
            fontSize: "14px",
            color: theme.palette.text.secondary
          },
          children: [availableModels.length, " / ", MAX_SLOT_INDEX, " ", t("common.model.slots_in_use")]
        })]
      }), jsxRuntime.jsxs("div", {
        style: {
          display: "flex"
        },
        children: [jsxRuntime.jsx("div", {
          style: {
            flex: "1",
            minWidth: 0
          },
          children: availableModels.length === 0 ? jsxRuntime.jsx("p", {
            style: {
              padding: "15px",
              margin: 0,
              color: theme.palette.text.primary
            },
            children: t("common.model.no_models")
          }) : jsxRuntime.jsxs("div", {
            style: {
              maxHeight: "500px",
              overflowY: "auto",
              padding: "15px"
            },
            children: [jsxRuntime.jsx("div", {
              id: "model-card-row",
              style: {
                display: "flex",
                flexDirection: "row",
                gap: "15px",
                width: "100%",
                overflowX: "auto"
              },
              children: modelCards
            }), jsxRuntime.jsx(Box, {
              sx: {
                display: "flex",
                justifyContent: "center",
                mt: 2
              },
              children: jsxRuntime.jsx(Pagination, {
                count: pageCount,
                page: currentPage,
                onChange: (be, ve) => setCurrentPage(ve),
                color: "primary",
                shape: "rounded",
                size: "small"
              })
            })]
          })
        }), jsxRuntime.jsxs("div", {
          style: {
            width: "200px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "15px",
            backgroundColor: theme.palette.background.paper,
            borderLeft: `1px solid ${theme.palette.divider}`
          },
          children: [jsxRuntime.jsx(Box, {
            sx: {
              minWidth: 0,
              display: "flex",
              width: "100%"
            },
            children: jsxRuntime.jsx(Tooltip, {
              title: t("common.model.upload.tooltip"),
              children: jsxRuntime.jsx(IconButton, {
                onClick: openUploadDialogForEmptySlot,
                color: "default",
                size: "large",
                sx: {
                  height: "48px",
                  width: "100%",
                  px: 2,
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
                    children: t("common.model.upload.button")
                  })]
                })
              })
            })
          }), jsxRuntime.jsx(Box, {
            sx: {
              minWidth: 0,
              display: "flex",
              width: "100%"
            },
            children: jsxRuntime.jsx(Tooltip, {
              title: t("common.model.edit.tooltip"),
              children: jsxRuntime.jsx(IconButton, {
                onClick: () => setModelEditorOpen(true),
                color: "default",
                size: "large",
                sx: {
                  height: "48px",
                  width: "100%",
                  px: 2,
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
                    width: "16",
                    height: "16",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "2",
                    children: [jsxRuntime.jsx("path", {
                      d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    }), jsxRuntime.jsx("path", {
                      d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    })]
                  }), jsxRuntime.jsx("span", {
                    style: {
                      fontSize: "14px",
                      whiteSpace: "nowrap"
                    },
                    children: t("common.model.edit.button")
                  })]
                })
              })
            })
          })]
        })]
      })]
    }), isModelEditorOpen ? jsxRuntime.jsx(ModelEditDialog, {
      onClose: () => setModelEditorOpen(false)
    }) : null, isUploadDialogOpen && uploadSlotIndex !== null && jsxRuntime.jsx(ModelUploadDialog, {
      onClose: () => setUploadDialogOpen(false),
      slotIndex: uploadSlotIndex
    })]
  }), [modelCards, isModelEditorOpen, setModelEditorOpen, isUploadDialogOpen, uploadSlotIndex, availableModels.length, t, theme.palette.background.default, theme.palette.background.paper, theme.palette.divider, theme.palette.mode, theme.palette.text.primary, theme.palette.text.secondary, openUploadDialogForEmptySlot, currentPage, pageCount, setCurrentPage]);
};
export { ModelSelector };
