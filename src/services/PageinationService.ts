// File: src/services/PaginationService.ts
type PaginationConfig = {
    pageSize?: number;
    maxPageButtons?: number;
};

export class PaginationService {
    static readonly DEFAULT_CONFIG = {
        pageSize: 20,  // 修改默认每页显示数量为20
        maxPageButtons: 2
    };

    static calculatePageRange(page: number, pageSize: number, totalItems: number) {
        const startIndex = (page - 1) * pageSize;
        return {
            startIndex,
            endIndex: Math.min(startIndex + pageSize, totalItems)
        };
    }

    /**
     * 构建分页按钮
     */
    static buildPaginationButtons(currentPage: number, totalPages: number, queryField: string, maxPageButtons: number = 2) {
        const buttons = [];

        // 上一页按钮
        buttons.push({
            text: '◀️ 上一页',
            callback_data: currentPage > 1 ? `rank_page_${currentPage - 1}_${queryField}` : 'no_more'
        });

        // 下一页按钮
        buttons.push({
            text: '下一页 ▶️',
            callback_data: currentPage < totalPages ? `rank_page_${currentPage + 1}_${queryField}` : 'no_more'
        });

        // 将按钮分组（每行最多3个）
        return this.chunkArray(buttons, 3);
    }


    private static chunkArray<T>(array: T[], size: number): T[][] {
        return Array.from(
            { length: Math.ceil(array.length / size) },
            (_, i) => array.slice(i * size, i * size + size)
        );
    }

}
