// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, useTranslation, useTheme, Typography, Box, Dialog, DialogContent, DialogTitle, LinearProgress } from "../../vendor/recovered-runtime.js";
const DownloadProgressDialog = ({
  open,
  sampleName,
  progress
}) => {
  const w = useTheme(),
    {
      t
    } = useTranslation();
  return jsxRuntime.jsxs(Dialog, {
    open,
    maxWidth: "sm",
    fullWidth: true,
    disableEscapeKeyDown: true,
    children: [jsxRuntime.jsx(DialogTitle, {
      sx: {
        textAlign: "center",
        pb: 1
      },
      children: t("common.sample_model_dialog.downloading_title")
    }), jsxRuntime.jsx(DialogContent, {
      sx: {
        pt: 1
      },
      children: jsxRuntime.jsxs(Box, {
        sx: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2
        },
        children: [jsxRuntime.jsx(Typography, {
          variant: "body1",
          color: "text.primary",
          sx: {
            fontWeight: "medium"
          },
          children: sampleName
        }), jsxRuntime.jsxs(Box, {
          sx: {
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 1
          },
          children: [jsxRuntime.jsx(LinearProgress, {
            variant: "determinate",
            value: progress,
            sx: {
              height: 12,
              borderRadius: 6,
              backgroundColor: w.palette.grey[300],
              "& .MuiLinearProgress-bar": {
                borderRadius: 6
              }
            }
          }), jsxRuntime.jsxs(Typography, {
            variant: "h6",
            color: "text.primary",
            sx: {
              textAlign: "center",
              fontWeight: "bold"
            },
            children: [progress, "%"]
          })]
        }), jsxRuntime.jsx(Typography, {
          variant: "body2",
          color: "text.secondary",
          sx: {
            textAlign: "center"
          },
          children: t("common.sample_model_dialog.downloading_wait_message")
        })]
      })
    })]
  });
};
export { DownloadProgressDialog };
