import { useState, useCallback, useEffect } from "react";
import { useDropzone, Accept } from "react-dropzone"; // Import useDropzone and Accept type
import { Button } from "@/components/ui/button";
import { X, UploadCloud, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploadInputProps {
  onFilesChange: (files: FileList | null) => void; // Keep FileList for consistency, but will only contain 0 or 1 file
  accept?: string;
  initialFiles?: FileList | null;
  disabled?: boolean;
}

// Helper to convert string accept to react-dropzone Accept object
const parseAcceptString = (acceptString: string): Accept => {
  const accept: Accept = {};
  acceptString.split(",").forEach((type) => {
    const trimmedType = type.trim();
    // Basic mapping, might need refinement for complex cases
    if (trimmedType.startsWith(".")) {
      // react-dropzone uses MIME types primarily, extensions are less direct
      // For common types, we can map, otherwise, rely on MIME wildcards
      if (trimmedType === ".pdf") accept["application/pdf"] = [];
      else if (trimmedType === ".doc") accept["application/msword"] = [];
      else if (trimmedType === ".docx")
        accept[
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ] = [];
      else if (trimmedType === ".xls") accept["application/vnd.ms-excel"] = [];
      else if (trimmedType === ".xlsx")
        accept[
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ] = [];
      else if (trimmedType === ".ppt")
        accept["application/vnd.ms-powerpoint"] = [];
      else if (trimmedType === ".pptx")
        accept[
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ] = [];
      // Add more mappings if needed, or use wildcards
    } else {
      accept[trimmedType] = [];
    }
  });
  return accept;
};

export function ImageUploadInput({
  onFilesChange,
  accept = "image/*", // Default to only images
  initialFiles = null,
  disabled = false,
}: ImageUploadInputProps) {
  // Ensure maxFiles is always 1 internally
  const effectiveMaxFiles = 1;

  const [files, setFiles] = useState<FileList | null>(initialFiles);
  const [previews, setPreviews] = useState<string[]>([]);

  const generatePreviews = useCallback((fileList: File[] | null) => {
    // Accept File[] now
    if (!fileList || fileList.length === 0) {
      setPreviews([]);
      return;
    }
    const newPreviews: string[] = [];
    const fileArray = fileList; // Already an array

    // ... (rest of generatePreviews logic remains the same) ...
    fileArray.forEach((file) => {
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === fileArray.length) {
            setPreviews(newPreviews);
          }
        };
        reader.readAsDataURL(file);
      } else {
        newPreviews.push(file.name);
        if (newPreviews.length === fileArray.length) {
          setPreviews(newPreviews);
        }
      }
    });
    if (fileArray.length > 0 && newPreviews.length === 0) {
      setPreviews(fileArray.map((f) => f.name));
    } else if (fileArray.length === 0) {
      setPreviews([]);
    }
  }, []);

  // Effect to generate previews when initialFiles change or component mounts
  useEffect(() => {
    // Convert FileList to File[] for generatePreviews if initialFiles exist
    generatePreviews(initialFiles ? Array.from(initialFiles) : null);
  }, [initialFiles, generatePreviews]); // Depend on initialFiles

  // react-dropzone callback
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach((rejected) => {
          rejected.errors.forEach((err: any) => {
            if (err.code === "file-too-large") {
              toast.error(`Error: ${rejected.file.name} is too large.`);
            } else if (err.code === "file-invalid-type") {
              toast.error(
                `Error: Invalid file type. Only images are accepted.`
              );
            } else if (err.code === "too-many-files") {
              toast.error(`Error: Only one file can be uploaded.`);
            } else {
              toast.error(`Error with ${rejected.file.name}: ${err.message}`);
            }
          });
        });
      }

      if (acceptedFiles.length > 0) {
        // Since maxFiles is 1, acceptedFiles will have at most one file
        const file = acceptedFiles[0];
        // Create a FileList with the single file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const newFileList = dataTransfer.files;

        setFiles(newFileList);
        onFilesChange(newFileList);
        generatePreviews([file]); // Pass single file in array
      } else if (rejectedFiles.length === 0 && files) {
        // If nothing new is accepted/rejected, but files existed, clear them
        // This handles dropping an invalid file when one was already selected
        setFiles(null);
        onFilesChange(null);
        generatePreviews(null);
      }
    },
    [onFilesChange, generatePreviews]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: parseAcceptString(accept),
    maxFiles: effectiveMaxFiles, // Use 1
    multiple: false, // Explicitly set multiple to false
    disabled: disabled,
    onDropRejected: (rejected) => {
      const tooMany = rejected.some((r) =>
        r.errors.some((e) => e.code === "too-many-files")
      );
      if (tooMany) {
        toast.error(`You can only upload one file.`);
      }
      // Other rejection reasons are handled in onDrop for more specific file feedback
    },
  });

  // Convert current FileList state back to File[] for removal logic
  const currentFilesArray = files ? Array.from(files) : [];

  const handleRemovePreview = (index: number) => {
    // Index will always be 0 if files exist
    const newFilesArray = [...currentFilesArray]; // Create a mutable copy
    newFilesArray.splice(index, 1); // Remove file at index

    // Create a new FileList from the modified array
    const dataTransfer = new DataTransfer();
    newFilesArray.forEach((file) => dataTransfer.items.add(file));
    const newFileList =
      dataTransfer.files.length > 0 ? dataTransfer.files : null;

    setFiles(newFileList);
    onFilesChange(newFileList);
    generatePreviews(newFilesArray); // Update previews with File[]
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Apply getRootProps to the drop zone container */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed border-muted-foreground/50 rounded-md p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-muted"
            : "hover:border-muted-foreground/70", // Use isDragActive for styling
          disabled ? "cursor-not-allowed opacity-50" : ""
        )}
      >
        {/* Apply getInputProps to the hidden input */}
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <UploadCloud className="w-10 h-10" />
          {isDragActive ? (
            <span>Drop the image here ...</span>
          ) : (
            <>
              {/* Updated text */}
              <span>Drag & drop an image here, or click to select</span>
              <span className="text-xs">(Max 1 image)</span>
            </>
          )}
        </div>
      </div>

      {/* Previews section - will only show one preview */}
      {previews.length > 0 && (
        // Simplified grid for single item, or keep grid for consistency
        <div
          className="grid grid-cols-1 gap-2 mt-2"
          style={{ maxWidth: "150px" }}
        >
          {previews.map((preview, index) => (
            // index will always be 0
            <div key={index} className="relative group aspect-square">
              {/* Preview rendering logic */}
              {preview.startsWith("data:image") ? (
                // Only image preview needed now
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="object-cover w-full h-full rounded-md border"
                />
              ) : (
                // Fallback for safety, though accept should prevent this
                <div className="w-full h-full rounded-md border bg-muted flex flex-col items-center justify-center p-1 text-center">
                  <ImageIcon className="w-6 h-6 mb-1 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground break-all line-clamp-2">
                    {preview}
                  </span>
                </div>
              )}
              {/* Remove button logic */}
              {!disabled && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5 opacity-80 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering dropzone's click
                    handleRemovePreview(index);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
