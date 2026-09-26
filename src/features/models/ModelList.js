// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { jsxRuntimeExports as jsxRuntime, reactExports as ReactRuntime, useTranslation, useTheme, IconButton, Box, Stack } from "../../vendor/recovered-runtime.js";
import { useAppRoot } from "../../state/app-root-context.js";
import { RightButtonArea as ModelActions } from "./ModelActions.js";
import { IconArea as ModelIcon } from "./ModelIcon.js";
import { InfoArea as ModelInfo } from "./ModelInfo.js";
import { ModelUploadDialog } from "./ModelUploadDialog.js";
import { SampleModelDailog as SampleModelDialog } from "./SampleModelDialog.js";
const ModelList = () => {
  const {
      t
    } = useTranslation(),
    {
      serverSlotInfos
    } = useAppRoot(),
    theme = useTheme(),
    [movingSlotIndex, setMovingSlotIndex] = ReactRuntime.useState(null),
    [visibleModelCount, setVisibleModelCount] = ReactRuntime.useState(10),
    [isUploadDialogOpen, setUploadDialogOpen] = ReactRuntime.useState(false),
    [uploadSlotIndex, setUploadSlotIndex] = ReactRuntime.useState(null),
    [isSampleDialogOpen, setSampleDialogOpen] = ReactRuntime.useState(false),
    [sampleSlotIndex, setSampleSlotIndex] = ReactRuntime.useState(null),
    sortedModels = ReactRuntime.useMemo(() => serverSlotInfos.sort((pe, le) => pe.slot_index - le.slot_index), [serverSlotInfos]);
  ReactRuntime.useEffect(() => {
    if (visibleModelCount >= sortedModels.length) return;
    const pe = setTimeout(() => {
      setVisibleModelCount(le => Math.min(le + 5, sortedModels.length));
    }, 100);
    return () => clearTimeout(pe);
  }, [visibleModelCount, sortedModels.length]);
  ReactRuntime.useEffect(() => {
    setVisibleModelCount(10);
  }, [sortedModels.length]);
  const openUploadDialog = pe => {
      setUploadSlotIndex(pe);
      setUploadDialogOpen(true);
    },
    openSampleDialog = pe => {
      setSampleSlotIndex(pe);
      setSampleDialogOpen(true);
    },
    modelRows = ReactRuntime.useMemo(() => sortedModels.slice(0, visibleModelCount).map((le, de) => {
      const he = movingSlotIndex !== null && movingSlotIndex !== de && le.voice_changer_type == null;
      return jsxRuntime.jsxs("div", {
        style: {
          padding: "15px",
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          gap: "15px",
          backgroundColor: he ? theme.palette.mode === "light" ? "rgba(25, 118, 210, 0.08)" : "rgba(144, 202, 249, 0.08)" : "transparent",
          transition: "background-color 0.2s",
          width: "100%"
        },
        onClick: () => {
          he && console.log("isMovingTarget", movingSlotIndex, de);
        },
        children: [jsxRuntime.jsx(ModelIcon, {
          model: le
        }), jsxRuntime.jsx(ModelInfo, {
          model: le
        }), jsxRuntime.jsx(ModelActions, {
          model: le,
          isMoving: movingSlotIndex,
          setIsMoving: setMovingSlotIndex,
          isMovingTarget: he,
          onUploadClick: openUploadDialog,
          onSampleModelClick: openSampleDialog
        })]
      }, de);
    }), [sortedModels, visibleModelCount, movingSlotIndex, setMovingSlotIndex, theme.palette.divider, theme.palette.mode]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsx(Box, {
      style: {
        maxHeight: "60vh",
        overflowY: "auto"
      },
      children: modelRows
    }), movingSlotIndex !== null && jsxRuntime.jsx("div", {
      style: {
        position: "sticky",
        bottom: 0,
        backgroundColor: theme.palette.background.paper,
        padding: "15px",
        borderTop: `1px solid ${theme.palette.divider}`,
        textAlign: "center"
      },
      children: jsxRuntime.jsx(IconButton, {
        onClick: () => setMovingSlotIndex(null),
        color: "default",
        sx: {
          height: "48px",
          minWidth: "160px",
          px: 2,
          border: "2px solid",
          borderColor: "grey.300",
          borderRadius: "12px",
          "&:hover": {
            borderColor: "primary.main"
          }
        },
        children: jsxRuntime.jsx(Stack, {
          direction: "row",
          spacing: 1,
          alignItems: "center",
          children: jsxRuntime.jsx("span", {
            style: {
              fontSize: "14px",
              whiteSpace: "nowrap"
            },
            children: t("common.model_editor.cancel_move")
          })
        })
      })
    }), isUploadDialogOpen && uploadSlotIndex !== null && jsxRuntime.jsx(ModelUploadDialog, {
      onClose: () => setUploadDialogOpen(false),
      slotIndex: uploadSlotIndex
    }), isSampleDialogOpen && sampleSlotIndex !== null && jsxRuntime.jsx(SampleModelDialog, {
      open: isSampleDialogOpen,
      onClose: () => setSampleDialogOpen(false),
      slotIndex: sampleSlotIndex
    })]
  });
};
export { ModelList };
