import React, { useState, useEffect } from 'react';
import { SafeZone, RADIUS_PRESETS, ZONE_COLORS } from '../types';
import { X, Check } from 'lucide-react';

interface ZoneEditorProps {
    zone?: SafeZone;
    isNew?: boolean;
    onSave: (zone: Partial<SafeZone>) => void;
    onCancel: () => void;
}

const ZoneEditor: React.FC<ZoneEditorProps> = ({ zone, isNew = false, onSave, onCancel }) => {
    const [name, setName] = useState(zone?.name || '');
    const [radius, setRadius] = useState(zone?.radius || 200);
    const [customRadius, setCustomRadius] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [color, setColor] = useState(zone?.color || ZONE_COLORS[0]);

    // Generate default name on mount for new zones
    useEffect(() => {
        if (isNew && !zone?.name) {
            setName(`Vùng an toàn ${new Date().toLocaleTimeString('vi-VN')}`);
        }
    }, [isNew, zone?.name]);

    const handleRadiusPreset = (value: number) => {
        setRadius(value);
        setUseCustom(false);
        setCustomRadius('');
    };

    const handleCustomRadius = (value: string) => {
        setCustomRadius(value);
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0 && num <= 20000) {
            setRadius(num);
            setUseCustom(true);
        }
    };

    const handleSave = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (name.trim() && radius > 0 && radius <= 20000) {
            console.log('ZoneEditor: Saving zone', { name: name.trim(), radius, color });
            onSave({
                name: name.trim(),
                radius,
                color,
            });
        } else {
            console.warn('ZoneEditor: Invalid data', { name, radius, color });
        }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
    };

    const handleModalClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const isValidCustom = () => {
        const num = parseInt(customRadius, 10);
        return !isNaN(num) && num > 0 && num <= 20000;
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center"
            style={{ zIndex: 9999 }}
            onClick={handleOverlayClick}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                onClick={handleModalClick}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-primary/10 to-secondary/10">
                    <h2 className="text-lg font-bold dark:text-white">
                        {isNew ? '🆕 Tạo vùng an toàn mới' : '✏️ Chỉnh sửa vùng an toàn'}
                    </h2>
                    <button
                        onClick={handleCancel}
                        type="button"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tên vùng an toàn
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                            placeholder="Nhập tên vùng..."
                            autoFocus
                        />
                    </div>

                    {/* Radius Presets */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bán kính vùng an toàn
                        </label>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {RADIUS_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleRadiusPreset(preset)}
                                    className={`py-2 px-3 text-sm rounded-lg border transition-all ${radius === preset && !useCustom
                                        ? 'bg-primary text-white border-primary shadow-md'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-primary dark:text-gray-300'
                                        }`}
                                >
                                    {preset >= 1000 ? `${preset / 1000}km` : `${preset}m`}
                                </button>
                            ))}
                        </div>

                        {/* Custom Radius */}
                        <div className="flex gap-2 items-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Tùy chỉnh:</span>
                            <input
                                type="number"
                                value={customRadius}
                                onChange={(e) => handleCustomRadius(e.target.value)}
                                className={`flex-1 px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white outline-none transition-all ${useCustom && isValidCustom()
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'border-gray-300 dark:border-gray-600'
                                    }`}
                                placeholder="1 - 20000"
                                min={1}
                                max={20000}
                            />
                            <span className="text-sm text-gray-500">m</span>
                        </div>
                        {customRadius && !isValidCustom() && (
                            <p className="text-xs text-red-500 mt-1">Bán kính phải từ 1 đến 20000 mét</p>
                        )}
                    </div>

                    {/* Current Radius Display */}
                    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-3 rounded-lg text-center border border-primary/20">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Bán kính đã chọn: </span>
                        <span className="text-lg font-bold text-primary">
                            {radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`}
                        </span>
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Màu sắc vùng an toàn
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {ZONE_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            {/* Custom color input */}
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-300"
                                title="Chọn màu tùy chỉnh"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!name.trim() || radius <= 0 || radius > 20000}
                        className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium shadow-lg shadow-primary/30"
                    >
                        <Check className="w-4 h-4" />
                        {isNew ? 'Tạo mới' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ZoneEditor;
