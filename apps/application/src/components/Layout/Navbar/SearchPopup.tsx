import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import SearchDropdown from "@/components/Search/SearchDropdown";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchPopup({ isOpen, onClose }: SearchPopupProps) {
  const {
    searchQuery,
    results,
    isLoading,
    isOpen: isDropdownOpen,
    handleSearch,
    clearSearch,
    handleResultClick,
    setIsOpen: setIsDropdownOpen,
  } = useGlobalSearch();

  if (!isOpen) return null;

  const handleClose = () => {
    clearSearch();
    onClose();
  };

  const handleSearchChange = (value: string) => {
    handleSearch(value);
    if (value.trim().length > 0) {
      setIsDropdownOpen(true);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={handleClose} />

      {/* Popup */}
      <div className="fixed top-0 left-0 right-0 bg-white z-50 p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Input
              placeholder="Buscar"
              className="w-full rounded-full bg-white placeholder:text-[14px] h-fit pr-20"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <SearchDropdown
              isOpen={isDropdownOpen}
              isLoading={isLoading}
              results={results}
              searchQuery={searchQuery}
              onResultClick={(type, id, metadata) => {
                handleResultClick(type, id, metadata);
                handleClose();
              }}
              onClose={() => setIsDropdownOpen(false)}
            />
          </div>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-800 p-2"
          >
            <X size={24} />
          </button>
        </div>
      </div>
    </>
  );
}
