export interface Dependencies {
    name: string;
    selector?: string;
    label?: string;
    file?: string;
    templateUrl?: string[];
    templatePath?: string[];
    styleUrls?: string[];
    providers?: Dependencies[];
    imports?: Dependencies[];
    exports?: Dependencies[];
    declarations?: Dependencies[];
    bootstrap?: Dependencies[];
    uses?: Dependencies[];
    __raw?: any;
}
export declare class Compiler {
    private files;
    private program;
    private engine;
    private __cache;
    private __nsModule;
    private unknown;
    constructor(files: string[], options: any);
    getDependencies(): Dependencies[];
    buildCache(sourceFiles: any): void;
    private buildComponentCache;
    private getSourceFileDecorators;
    private debug;
    private isComponent;
    private isModule;
    private getSymboleName;
    private getComponentSelector;
    private getModuleProviders;
    private findProps;
    private getModuleDeclations;
    private getModuleImports;
    private getModuleExports;
    private getModuleBootstrap;
    private getComponentProviders;
    private getComponentDependentDirectives;
    private getComponentDirectives;
    private parseDeepIndentifier;
    private getComponentTemplateUrl;
    private getComponentStyleUrls;
    private sanitizeUrls;
    private getSymbolDeps;
    private findComponentSelectorByName;
}
