import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import imageCompression from "browser-image-compression";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase";
import { uploadProductImage, getCustomCategories, createCustomCategory, deleteCustomCategory } from "@/lib/api/supabase.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Product } from "@/lib/supabase";
import { getAvailableProductCategories, normalizeProductCategories, PRODUCT_CATEGORY_OPTIONS, LEGACY_PRODUCT_CATEGORY_OPTIONS } from "@/lib/productCategories";

export type ProductFormData = {
  name: string;
  price: number;
  description: string;
  category: string;
  tag: string;
  swatch: string;
  stock_qty: number;
  is_active: boolean;
  images: string[];
  materials: string;
  dimensions: string;
  care_instructions: string;
  return_policy: string;
};

interface ProductFormProps {
  initialData?: Partial<Product>;
  onSubmit: (data: ProductFormData, accessToken?: string) => Promise<void>;
  isLoading: boolean;
}

export function ProductForm({ initialData, onSubmit, isLoading }: ProductFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tagOptions = ["New", "Best seller", "Limited", "Featured", "Gift"];

  const [name, setName] = useState(initialData?.name ?? "");
  const [priceInput, setPriceInput] = useState(initialData?.price != null ? String(initialData.price) : "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialData?.category ? normalizeProductCategories(initialData.category) : [],
  );
  const [categorySelect, setCategorySelect] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.tag ? initialData.tag.split(",").map((item) => item.trim()).filter(Boolean) : [],
  );
  const [tagSelect, setTagSelect] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [swatch, setSwatch] = useState(initialData?.swatch ?? "#f7c8d9");
  const [stockQtyInput, setStockQtyInput] = useState(initialData?.stock_qty != null ? String(initialData.stock_qty) : "");
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [images, setImages] = useState<string[]>(initialData?.images ?? []);
  const [materials, setMaterials] = useState(initialData?.materials ?? "");
  const [dimensions, setDimensions] = useState(initialData?.dimensions ?? "");
  const [careInstructions, setCareInstructions] = useState(initialData?.care_instructions ?? "");
  const [returnPolicy, setReturnPolicy] = useState(initialData?.return_policy ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const { data: customCategories = [] } = useQuery<string[]>({
    queryKey: ["custom-categories"],
    queryFn: () => getCustomCategories(),
  });

  const isCustomCategory = (name: string) =>
    !PRODUCT_CATEGORY_OPTIONS.includes(name as any) &&
    !LEGACY_PRODUCT_CATEGORY_OPTIONS.includes(name as any);

  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAccessToken = async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  useEffect(() => {
    setName(initialData?.name ?? "");
    setPriceInput(initialData?.price != null ? String(initialData.price) : "");
    setDescription(initialData?.description ?? "");
    setSelectedCategories(initialData?.category ? normalizeProductCategories(initialData.category) : []);
    setCategorySelect("");
    setCustomCategory("");
    setShowCategoryInput(false);
    setSelectedTags(
      initialData?.tag ? initialData.tag.split(",").map((item) => item.trim()).filter(Boolean) : [],
    );
    setTagSelect("");
    setCustomTag("");
    setShowTagInput(false);
    setSwatch(initialData?.swatch ?? "#f7c8d9");
    setStockQtyInput(initialData?.stock_qty != null ? String(initialData.stock_qty) : "");
    setIsActive(initialData?.is_active ?? true);
    setImages(initialData?.images ?? []);
    setMaterials(initialData?.materials ?? "");
    setDimensions(initialData?.dimensions ?? "");
    setCareInstructions(initialData?.care_instructions ?? "");
    setReturnPolicy(initialData?.return_policy ?? "");
  }, [initialData]);

  const categoryString = selectedCategories.join(", ");
  const tagString = selectedTags.join(", ");

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE_MB = 20;

  const fileToBase64 = (file: File): Promise<string | null> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const addCategory = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || selectedCategories.includes(trimmed)) return;
    setSelectedCategories((current) => [...current, trimmed]);
    if (!PRODUCT_CATEGORY_OPTIONS.includes(trimmed as any) && !LEGACY_PRODUCT_CATEGORY_OPTIONS.includes(trimmed as any)) {
      try {
        const accessToken = await getAccessToken();
        await createCustomCategory({ data: { name: trimmed, accessToken } });
        await queryClient.invalidateQueries({ queryKey: ["custom-categories"] });
      } catch {
        // Non-blocking — the category is still added to this product even if persisting fails.
      }
    }
  };

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || selectedTags.includes(trimmed)) return;
    setSelectedTags((current) => [...current, trimmed]);
  };

  const handleCategorySelect = (value: string) => {
    if (!value) return;
    if (value === "new") {
      setShowCategoryInput(true);
      setCategorySelect("");
      return;
    }
    addCategory(value);
    setCategorySelect("");
  };

  const handleTagSelect = (value: string) => {
    if (!value) return;
    if (value === "new") {
      setShowTagInput(true);
      setTagSelect("");
      return;
    }
    addTag(value);
    setTagSelect("");
  };

  const removeCategory = (value: string) => {
    setSelectedCategories((current) => current.filter((item) => item !== value));
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      const accessToken = await getAccessToken();
      await deleteCustomCategory({ data: { name: categoryToDelete, accessToken } });
      setSelectedCategories((current) => current.filter((c) => c !== categoryToDelete));
      await queryClient.invalidateQueries({ queryKey: ["custom-categories"] });
      setCategoryToDelete(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete category.");
      setCategoryToDelete(null);
    }
  };

  const removeTag = (value: string) => {
    setSelectedTags((current) => current.filter((item) => item !== value));
  };

  const presetSwatches = ["#f7c8d9", "#fde68a", "#a7f3d0", "#bfdbfe", "#fbcfe8", "#fcd34d"];

  const productSwatchStyle = useMemo(
    () => ({ backgroundColor: swatch || "var(--blush)" }),
    [swatch],
  );

  const handleCustomColor = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSwatch(event.target.value);
  };

  const openColorPicker = () => {
    colorInputRef.current?.click();
  };

  const openFileChooser = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnter = () => {
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    handleImageFiles(event.dataTransfer.files);
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (images.length + files.length > 8) {
      setUploadError("You can upload up to 8 images.");
      return;
    }

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError(`"${file.name}" is not supported. Please use JPG, PNG, WEBP or GIF.`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setUploadError(`"${file.name}" is too large. Max size is ${MAX_SIZE_MB} MB.`);
        return;
      }
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    const uploadUrls: string[] = [];

    try {
      const fileArray = Array.from(files);
      for (let index = 0; index < fileArray.length; index += 1) {
        const file = fileArray[index];

        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });

        const base64 = await fileToBase64(compressedFile);
        if (!base64) {
          throw new Error(`Could not read file "${file.name}". Please try a different image.`);
        }

        const accessToken = await getAccessToken();
        const result = await uploadProductImage({
          data: {
            fileName: `${Date.now()}-${file.name}`,
            base64,
            accessToken,
          },
        });

        uploadUrls.push(result.publicUrl);
        setUploadProgress(Math.round(((index + 1) / fileArray.length) * 100));
      }

      setImages((current) => [...current, ...uploadUrls]);
    } catch (error: unknown) {
      let msg = "Upload failed. Please try again.";
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === "string") {
        msg = error;
      } else {
        try { msg = JSON.stringify(error); } catch { /* keep default */ }
      }
      setUploadError(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async () => {
    const price = Number(priceInput);
    const stockQty = Number(stockQtyInput);

    if (name.trim() === "" || priceInput.trim() === "" || stockQtyInput.trim() === "") {
      setFormError("Please complete the required fields before saving this product.");
      return;
    }

    if (Number.isNaN(price) || Number.isNaN(stockQty)) {
      setFormError("Please enter valid numbers for price and stock quantity.");
      return;
    }

    setFormError(null);
    const accessToken = await getAccessToken();
    await onSubmit(
      {
        name,
        price,
        description,
        category: categoryString,
        tag: tagString,
        swatch,
        stock_qty: stockQty,
        is_active: isActive,
        images,
        materials,
        dimensions,
        care_instructions: careInstructions,
        return_policy: returnPolicy,
      },
      accessToken,
    );
  };

  const handleDiscard = () => {
    setName(initialData?.name ?? "");
    setPriceInput(initialData?.price != null ? String(initialData.price) : "");
    setDescription(initialData?.description ?? "");
    setSelectedCategories(initialData?.category ? normalizeProductCategories(initialData.category) : []);
    setSelectedTags(
      initialData?.tag ? initialData.tag.split(",").map((item) => item.trim()).filter(Boolean) : [],
    );
    setSwatch(initialData?.swatch ?? "#f7c8d9");
    setStockQtyInput(initialData?.stock_qty != null ? String(initialData.stock_qty) : "");
    setIsActive(initialData?.is_active ?? true);
    setImages(initialData?.images ?? []);
    setMaterials(initialData?.materials ?? "");
    setDimensions(initialData?.dimensions ?? "");
    setCareInstructions(initialData?.care_instructions ?? "");
    setReturnPolicy(initialData?.return_policy ?? "");
    setUploadError(null);
    setFormError(null);
    setShowCategoryInput(false);
    setShowTagInput(false);
    setCustomCategory("");
    setCustomTag("");
    setCategorySelect("");
    setTagSelect("");
  };

  const removeImage = (url: string) => {
    setImages((current) => current.filter((image) => image !== url));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Product details</h2>
          <p className="text-sm text-gray-500">Fill in the information below to create your product.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={!initialData?.id}
            onClick={() => {
              if (initialData?.id) {
                navigate({ to: "/shop/$id", params: { id: initialData.id } });
              }
            }}
          >
            {initialData?.id ? "Preview" : "Save first to preview"}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save product"}
          </Button>
        </div>
      </div>

      {formError && (
        <Alert variant="destructive" className="rounded-lg">
          {formError}
        </Alert>
      )}

      {/* Basic Info */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Basic info</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product display name"
            />
            <p className="text-xs text-gray-400">Enter the product display name.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-price">
              Price <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₱</span>
              <Input
                id="product-price"
                type="text"
                inputMode="numeric"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="pl-8"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-gray-400">Set the retail price in Philippine pesos.</p>
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product-desc">Description</Label>
              <span className="text-xs text-gray-400">{description.length}</span>
            </div>
            <textarea
              id="product-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Describe product details, materials, and benefits..."
            />
          </div>
        </div>
      </div>

      {/* Details & Policies */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Details &amp; policies</h3>
        <p className="text-xs text-gray-400 mb-4">
          Optional. Shown on the product page only when filled in — leave blank to hide a section.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product-materials">Materials</Label>
              <span className="text-xs text-gray-400">{materials.length}</span>
            </div>
            <textarea
              id="product-materials"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Hand-shaped air-dry clay, sealed with matte varnish..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product-dimensions">Dimensions</Label>
              <span className="text-xs text-gray-400">{dimensions.length}</span>
            </div>
            <textarea
              id="product-dimensions"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Approx. 12cm diameter × 15cm height..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product-care">Care instructions</Label>
              <span className="text-xs text-gray-400">{careInstructions.length}</span>
            </div>
            <textarea
              id="product-care"
              value={careInstructions}
              onChange={(e) => setCareInstructions(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Decorative only; keep dry and away from direct sunlight..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="product-return-policy">Return policy</Label>
              <span className="text-xs text-gray-400">{returnPolicy.length}</span>
            </div>
            <textarea
              id="product-return-policy"
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Refunds on unopened items within 7 days of delivery..."
            />
          </div>
        </div>
      </div>

      {/* Category & Tags */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Category & tags</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              value={categorySelect}
              onChange={(e) => {
                setCategorySelect(e.target.value);
                handleCategorySelect(e.target.value);
              }}
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a category</option>
              {getAvailableProductCategories(selectedCategories).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              {customCategories
                .filter(
                  (c) =>
                    !PRODUCT_CATEGORY_OPTIONS.includes(c as any) &&
                    !LEGACY_PRODUCT_CATEGORY_OPTIONS.includes(c as any) &&
                    !selectedCategories.includes(c) &&
                    !getAvailableProductCategories(selectedCategories).includes(c),
                )
                .map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              <option value="new">Add custom category</option>
            </select>
            {showCategoryInput && (
              <div className="flex gap-2">
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type a new category"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addCategory(customCategory);
                    setCustomCategory("");
                    setShowCategoryInput(false);
                  }}
                >
                  Add
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {selectedCategories.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => removeCategory(value)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {value}
                  {isCustomCategory(value) ? (
                    <span
                      role="button"
                      tabIndex={0}
                      title={`Delete "${value}" from system`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryToDelete(value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setCategoryToDelete(value);
                        }
                      }}
                      className="ml-0.5 text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="text-gray-400">×</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">Choose one or more categories and remove them by clicking the pill.</p>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <select
              value={tagSelect}
              onChange={(e) => {
                setTagSelect(e.target.value);
                handleTagSelect(e.target.value);
              }}
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a tag</option>
              {tagOptions.filter((o) => !selectedTags.includes(o)).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              <option value="new">Add custom tag</option>
            </select>
            {showTagInput && (
              <div className="flex gap-2">
                <Input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="Type a new tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addTag(customTag);
                    setCustomTag("");
                    setShowTagInput(false);
                  }}
                >
                  Add
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => removeTag(value)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {value}
                  <span className="text-gray-400">×</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">Add tags for special collections, promotions, or product highlights.</p>
          </div>
        </div>
      </div>

      {/* Inventory & Appearance */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Inventory & appearance</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Swatch</Label>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap gap-3">
                {presetSwatches.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSwatch(value)}
                    className={cn(
                      "h-11 w-11 rounded-full border transition-all",
                      value === swatch
                        ? "border-indigo-500 outline outline-2 outline-indigo-500 outline-offset-2"
                        : "border-gray-200",
                    )}
                    style={{ backgroundColor: value }}
                  />
                ))}
                <button
                  type="button"
                  onClick={openColorPicker}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Custom
                </button>
              </div>
              <input
                ref={colorInputRef}
                type="color"
                value={swatch}
                onChange={handleCustomColor}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-400">Choose a preset swatch or add a custom color for this product.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-stock">
              Stock quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="product-stock"
              type="text"
              inputMode="numeric"
              value={stockQtyInput}
              onChange={(e) => setStockQtyInput(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
            {Number(stockQtyInput) > 0 && Number(stockQtyInput) <= 5 ? (
              <Alert variant="warning" className="rounded-lg text-xs py-2">
                Low stock warning at 5 units.
              </Alert>
            ) : (
              <p className="text-xs text-gray-400">Low stock warning at 5 units.</p>
            )}
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-gray-900">Active</Label>
              <p className="text-xs text-gray-400">
                {isActive ? "Active — product is visible in shop" : "Inactive — hidden from shop"}
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Product images</h3>

        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "rounded-lg border-2 border-dashed px-6 py-8 text-center transition cursor-pointer",
            isDragActive
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-200 bg-gray-50 hover:bg-gray-100/50",
          )}
        >
          <p className="text-sm font-medium text-gray-600">Drag and drop images here</p>
          <p className="mt-1 text-xs text-gray-400">or click to choose files</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openFileChooser}>
            Choose files
          </Button>
          <p className="mt-2 text-[10px] text-gray-400">
            JPG, PNG, WEBP, GIF · max 20MB · up to 8 images
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleImageFiles(e.target.files)}
            className="hidden"
          />
        </div>

        {uploading && (
          <div className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-xs text-gray-600">
            Uploading images... {uploadProgress}%
          </div>
        )}

        {uploadError && (
          <p className="mt-2 text-xs text-red-500">{uploadError}</p>
        )}

        {images.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((src) => (
              <div key={src} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white">
                <img src={src} alt="Product preview" className="h-36 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(src)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between gap-3 border-t pt-5">
        <Button type="button" variant="outline" onClick={handleDiscard} className="text-red-600 border-red-200 hover:bg-red-50">
          Discard changes
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save product"}
        </Button>
      </div>

      <AlertDialog open={categoryToDelete !== null} onOpenChange={(open) => { if (!open) setCategoryToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{categoryToDelete}</strong> from the category list. You can re-add it later as a custom category if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

