// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme, IconButton, Button, Dialog, DialogContent, DialogTitle, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { CloseIcon } from "../../components/icons.js";
import { DownloadProgressDialog } from "../../components/common/DownloadProgressDialog.js";
const SampleModelDialog = ({
  open,
  onClose,
  slotIndex
}) => {
  const {
      samples,
      downloadSample,
      triggerToast,
      reloadServerSlotInfos,
      getTask
    } = useAppRoot(),
    A = useTheme(),
    {
      t
    } = useTranslation(),
    [H, ee] = ReactRuntime.useState({
      isDownloading: false,
      progress: 0,
      currentSampleId: null,
      currentSampleName: ""
    }),
    te = ReactRuntime.useCallback(async ie => {
      const ne = samples.find(ae => ae.id === ie);
      if (ne) try {
        ee({
          isDownloading: true,
          progress: 0,
          currentSampleId: ie,
          currentSampleName: ne.name
        });
        const ae = await downloadSample(slotIndex, ie),
          se = async (ce, fe) => {
            setTimeout(async () => {
              const pe = await getTask(ce);
              if (pe === null) {
                console.warn("download sample task is null");
                ee(he => ({
                  ...he,
                  isDownloading: false
                }));
                return;
              }
              const le = pe.progress || 0,
                de = Math.round(le * 100);
              if (ee(he => ({
                ...he,
                progress: de
              })), pe.status === "done") {
                ee(he => ({
                  ...he,
                  progress: 100
                }));
                reloadServerSlotInfos();
                triggerToast("success", t("common.sample_model_dialog.download_success"));
                setTimeout(() => {
                  ee({
                    isDownloading: false,
                    progress: 0,
                    currentSampleId: null,
                    currentSampleName: ""
                  });
                }, 1500);
                onClose();
                return;
              }
              if (fe > 60) {
                console.warn("download sample check is timeout");
                ee(he => ({
                  ...he,
                  isDownloading: false
                }));
                triggerToast("error", t("common.sample_model_dialog.download_timeout"));
                return;
              } else se(ce, fe + 1);
            }, 1e3 * 1);
          };
        se(ae.id, 0);
      } catch {
        ee(ae => ({
          ...ae,
          isDownloading: false
        }));
        triggerToast("error", t("common.sample_model_dialog.download_error"));
      }
    }, [downloadSample, slotIndex, triggerToast, samples, reloadServerSlotInfos, getTask, onClose, t]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsxs(Dialog, {
      open,
      onClose,
      maxWidth: "sm",
      fullWidth: true,
      children: [jsxRuntime.jsxs(DialogTitle, {
        sx: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        },
        children: [t("common.sample_model_dialog.title"), jsxRuntime.jsx(IconButton, {
          onClick: onClose,
          size: "large",
          children: jsxRuntime.jsx(CloseIcon, {})
        })]
      }), jsxRuntime.jsx("div", {
        style: {
          padding: "0 24px 8px 24px",
          fontSize: 14,
          color: A.palette.text.secondary
        },
        children: t("common.sample_model_dialog.slot_id", {
          slotIndex: slotIndex + 1
        })
      }), jsxRuntime.jsx(DialogContent, {
        children: jsxRuntime.jsxs("div", {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          },
          children: [samples.length === 0 && jsxRuntime.jsx("div", {
            children: t("common.sample_model_dialog.no_samples")
          }), samples.map(ie => jsxRuntime.jsxs("div", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "16px",
              borderBottom: `1px solid ${A.palette.divider}`,
              padding: "8px 0"
            },
            children: [jsxRuntime.jsx("div", {
              style: {
                width: 64,
                height: 64,
                borderRadius: 8,
                overflow: "hidden",
                background: A.palette.background.default,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              },
              children: ie.icon_url ? jsxRuntime.jsx("img", {
                src: ie.icon_url,
                alt: ie.name,
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }
              }) : jsxRuntime.jsx("div", {
                style: {
                  fontSize: 32,
                  color: A.palette.text.secondary
                },
                children: ie.name.charAt(0).toUpperCase()
              })
            }), jsxRuntime.jsxs("div", {
              style: {
                flex: 1,
                minWidth: 0
              },
              children: [jsxRuntime.jsx("div", {
                style: {
                  fontWeight: "bold",
                  fontSize: 16,
                  color: A.palette.text.primary
                },
                children: ie.name
              }), jsxRuntime.jsx("div", {
                style: {
                  fontSize: 13,
                  color: A.palette.text.secondary,
                  margin: "2px 0"
                },
                children: ie.description
              }), jsxRuntime.jsxs("div", {
                style: {
                  fontSize: 12,
                  color: A.palette.text.secondary
                },
                children: [ie.credit && jsxRuntime.jsxs("span", {
                  children: [t("common.sample_model.credit"), " ", ie.credit, " "]
                }), ie.lang && jsxRuntime.jsxs("span", {
                  children: [t("common.sample_model.language"), " ", ie.lang, " "]
                }), ie.tag && ie.tag.length > 0 && jsxRuntime.jsxs("span", {
                  children: [t("common.sample_model.tags"), " ", ie.tag.join(", "), " "]
                }), ie.terms_of_use_url && jsxRuntime.jsx("a", {
                  href: ie.terms_of_use_url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: {
                    marginLeft: 8,
                    color: A.palette.primary.main,
                    textDecoration: "underline"
                  },
                  children: t("common.sample_model.terms_of_use")
                })]
              })]
            }), jsxRuntime.jsx(Stack, {
              direction: "row",
              spacing: 1,
              children: jsxRuntime.jsx(Button, {
                variant: "contained",
                color: "primary",
                onClick: () => te(ie.id),
                disabled: H.isDownloading,
                children: t("common.sample_model_dialog.download_button")
              })
            })]
          }, ie.id))]
        })
      })]
    }), jsxRuntime.jsx(DownloadProgressDialog, {
      open: H.isDownloading,
      sampleName: H.currentSampleName,
      progress: H.progress
    })]
  });
};
export { SampleModelDialog as SampleModelDailog };
