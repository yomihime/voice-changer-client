// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, React, useTranslation, useTheme, IconButton, Button, FormControl, InputLabel, LinearProgress, MenuItem, Select } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog.js";
import { VoiceChangerType } from "../../domain/constants.js";
import { CloseIcon } from "../../components/icons.js";
const ModelUploadDialog = props => {
  const {
      onClose
    } = props,
    {
      t
    } = useTranslation(),
    theme = useTheme(),
    [voiceChangerType, setVoiceChangerType] = React.useState("RVC"),
    [modelFile, setModelFile] = React.useState(null),
    [indexFile, setIndexFile] = React.useState(null),
    [beatriceZipFile, setBeatriceZipFile] = React.useState(null),
    modelFileInputRef = React.useRef(null),
    indexFileInputRef = React.useRef(null),
    zipFileInputRef = React.useRef(null),
    appRoot = useAppRoot(),
    [isUploading, setUploading] = React.useState(false),
    [uploadProgress, setUploadProgress] = React.useState(0),
    [isUploadCompleteDialogOpen, setUploadCompleteDialogOpen] = ReactRuntime.useState(false),
    uploadModel = ReactRuntime.useCallback(async () => {
      if (!props.slotIndex && props.slotIndex !== 0) return;
      const be = [];
      if (voiceChangerType === VoiceChangerType.RVC) {
        if (!modelFile) {
          alert(t("common.model_upload.select_model_file_error"));
          return;
        }
        be.push({
          kind: "rvcModel",
          file: modelFile
        });
        indexFile && be.push({
          kind: "rvcIndex",
          file: indexFile
        });
      } else if (voiceChangerType === VoiceChangerType.Beatrice_v2) {
        if (!beatriceZipFile) {
          alert(t("common.model_upload.select_zip_error"));
          return;
        }
        be.push({
          kind: "beatriceV2Zip",
          file: beatriceZipFile
        });
      } else {
        alert(t("common.model_upload.unsupported_voice_changer_type"));
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      try {
        await appRoot.uploadModelFile(props.slotIndex, voiceChangerType, be, null, (ve, xe) => {
          setUploadProgress(ve);
          xe && (setUploadProgress(100), setUploading(false), setUploadCompleteDialogOpen(true));
        });
      } catch (ve) {
        setUploading(false);
        let xe = t("common.model_upload.upload_error");
        if (console.log(xe, ve), typeof ve == "object" && ve !== null && "reason" in ve && "detail" in ve && "action" in ve) {
          const Ce = ve;
          appRoot.triggerToast("error", jsxRuntime.jsxs("div", {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            },
            children: [jsxRuntime.jsx("div", {
              style: {
                fontWeight: "bold",
                fontSize: "1rem"
              },
              children: xe
            }), jsxRuntime.jsx("div", {
              style: {
                fontSize: "0.9rem"
              },
              children: Ce.reason ?? ""
            }), jsxRuntime.jsxs("div", {
              style: {
                fontSize: "0.9rem"
              },
              children: [" ", Ce.detail ?? "", " "]
            }), jsxRuntime.jsx("div", {
              style: {
                fontSize: "0.9rem"
              },
              children: Ce.action ?? ""
            })]
          }));
          return;
        } else {
          typeof ve == "object" && ve && "message" in ve && typeof ve.message == "string" && (xe += ve.message);
          appRoot.triggerToast("error", xe);
        }
      }
    }, [props.slotIndex, voiceChangerType, modelFile, indexFile, beatriceZipFile, appRoot, t]),
    closeUploadCompleteDialog = ReactRuntime.useCallback(() => {
      setUploadCompleteDialogOpen(false);
      onClose();
    }, [onClose]),
    uploadDialog = ReactRuntime.useMemo(() => jsxRuntime.jsx("div", {
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1e3
      },
      onClick: onClose,
      children: jsxRuntime.jsxs("div", {
        style: {
          backgroundColor: theme.palette.background.paper,
          borderRadius: "8px",
          padding: "20px",
          width: "90%",
          maxWidth: "800px",
          maxHeight: "80vh",
          overflow: "auto",
          color: theme.palette.text.primary
        },
        onClick: be => be.stopPropagation(),
        children: [jsxRuntime.jsxs("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px"
          },
          children: [jsxRuntime.jsx("h2", {
            style: {
              margin: 0
            },
            children: t("common.model_upload.title")
          }), jsxRuntime.jsx(IconButton, {
            onClick: onClose,
            size: "large",
            sx: {
              color: theme.palette.text.secondary
            },
            children: jsxRuntime.jsx(CloseIcon, {})
          })]
        }), jsxRuntime.jsx("div", {
          style: {
            marginBottom: "20px",
            color: theme.palette.text.primary
          },
          children: t("common.model_upload.slot_info", {
            slotNumber: (props.slotIndex ?? 0) + 1
          })
        }), jsxRuntime.jsxs(FormControl, {
          fullWidth: true,
          sx: {
            marginBottom: "20px"
          },
          children: [jsxRuntime.jsx(InputLabel, {
            id: "voice-changer-type-label",
            children: t("common.model_upload.voice_changer_type")
          }), jsxRuntime.jsx(Select, {
            labelId: "voice-changer-type-label",
            value: voiceChangerType,
            label: t("common.model_upload.voice_changer_type"),
            onChange: be => {
              be.target.value === VoiceChangerType.RVC ? setVoiceChangerType(be.target.value) : be.target.value === VoiceChangerType.Beatrice_v2 && alert(t("common.model_upload.beatrice_v2_not_supported_yet"));
            },
            children: jsxRuntime.jsx(MenuItem, {
              value: VoiceChangerType.RVC,
              children: "RVC"
            })
          })]
        }), voiceChangerType === VoiceChangerType.RVC && jsxRuntime.jsxs("div", {
          style: {
            marginBottom: "20px"
          },
          children: [jsxRuntime.jsxs("div", {
            style: {
              marginBottom: "10px",
              display: "flex",
              alignItems: "center"
            },
            children: [jsxRuntime.jsx(Button, {
              variant: "outlined",
              component: "span",
              onClick: () => modelFileInputRef.current?.click(),
              sx: {
                marginRight: "10px",
                width: 200,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap"
              },
              children: jsxRuntime.jsx("span", {
                style: {
                  display: "inline-block",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  verticalAlign: "middle"
                },
                children: t("common.model_upload.select_model_file")
              })
            }), jsxRuntime.jsx("input", {
              ref: modelFileInputRef,
              type: "file",
              accept: ".pth,.onnx",
              style: {
                display: "none"
              },
              onChange: be => setModelFile(be.target.files?.[0] || null)
            }), modelFile && jsxRuntime.jsx("span", {
              style: {
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
                verticalAlign: "middle"
              },
              children: modelFile.name
            })]
          }), jsxRuntime.jsxs("div", {
            style: {
              display: "flex",
              alignItems: "center"
            },
            children: [jsxRuntime.jsx(Button, {
              variant: "outlined",
              component: "span",
              onClick: () => indexFileInputRef.current?.click(),
              sx: {
                marginRight: "10px",
                width: 200,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap"
              },
              children: jsxRuntime.jsx("span", {
                style: {
                  display: "inline-block",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  verticalAlign: "middle"
                },
                children: t("common.model_upload.select_index_file")
              })
            }), jsxRuntime.jsx("input", {
              ref: indexFileInputRef,
              type: "file",
              accept: ".index,.bin",
              style: {
                display: "none"
              },
              onChange: be => setIndexFile(be.target.files?.[0] || null)
            }), indexFile && jsxRuntime.jsx("span", {
              style: {
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
                verticalAlign: "middle"
              },
              children: indexFile.name
            })]
          })]
        }), voiceChangerType === VoiceChangerType.Beatrice_v2 && jsxRuntime.jsxs("div", {
          style: {
            marginBottom: "20px",
            display: "flex",
            alignItems: "center"
          },
          children: [jsxRuntime.jsx(Button, {
            variant: "outlined",
            component: "span",
            onClick: () => zipFileInputRef.current?.click(),
            sx: {
              marginRight: "10px",
              width: 200,
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap"
            },
            children: jsxRuntime.jsx("span", {
              style: {
                display: "inline-block",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                verticalAlign: "middle"
              },
              children: t("common.model_upload.select_zip")
            })
          }), jsxRuntime.jsx("input", {
            ref: zipFileInputRef,
            type: "file",
            accept: ".zip",
            style: {
              display: "none"
            },
            onChange: be => setBeatriceZipFile(be.target.files?.[0] || null)
          }), beatriceZipFile && jsxRuntime.jsx("span", {
            style: {
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "inline-block",
              verticalAlign: "middle"
            },
            children: beatriceZipFile.name
          })]
        }), isUploading && jsxRuntime.jsxs("div", {
          style: {
            marginBottom: 20
          },
          children: [jsxRuntime.jsx(LinearProgress, {
            variant: "determinate",
            value: uploadProgress
          }), jsxRuntime.jsxs("div", {
            style: {
              textAlign: "right",
              fontSize: "0.9rem",
              marginTop: 4
            },
            children: [uploadProgress, "%"]
          })]
        }), jsxRuntime.jsx("div", {
          style: {
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "30px"
          },
          children: jsxRuntime.jsx(Button, {
            variant: "contained",
            color: "primary",
            onClick: uploadModel,
            children: t("common.model_upload.upload_button")
          })
        })]
      })
    }), [onClose, t, theme, voiceChangerType, modelFile, indexFile, beatriceZipFile, uploadModel, props.slotIndex, isUploading, uploadProgress]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [uploadDialog, jsxRuntime.jsx(ConfirmationDialog, {
      isOpen: isUploadCompleteDialogOpen,
      title: t("common.model_upload.upload_complete_title"),
      message: t("common.model_upload.upload_complete_message"),
      confirmButtonText: "OK",
      cancelButtonText: "OK",
      onConfirm: closeUploadCompleteDialog,
      onCancel: closeUploadCompleteDialog,
      showCancelButton: false
    })]
  });
};
export { ModelUploadDialog };
