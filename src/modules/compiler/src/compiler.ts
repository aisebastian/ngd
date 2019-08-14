import * as path from 'path';
import * as ts from 'typescript';
import { logger, getNewLineCharacter, compilerHost, d } from '@compodoc/ngd-core';

var fs = require('fs');
var DOMParser = require('dom-parser');


interface NodeObject {
  kind: Number;
  pos: Number;
  end: Number;
  text: string;
  initializer: NodeObject,
  name?: { text: string };
  expression?: NodeObject;
  elements?: NodeObject[];
  arguments?: NodeObject[];
  properties?: any[];
  parserContextFlags?: Number;
  equalsGreaterThanToken?: NodeObject[];
  parameters?: NodeObject[];
  Component?: String;
  body?: {
    pos: Number;
    end: Number;
    statements: NodeObject[];
  }
}

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
  __raw?: any
}

interface SymbolDeps {
  full: string;
  alias: string;
}

export class Compiler {

  private files: string[];
  private program: ts.Program;
  private engine: any;
  private __cache: any = {};
  private __nsModule: any = {};
  private unknown = '???';

  constructor(files: string[], options: any) {
    this.files = files;
    const transpileOptions = {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS,
      tsconfigDirectory: options.tsconfigDirectory
    };
    this.program = ts.createProgram(this.files, transpileOptions, compilerHost(transpileOptions));

    // silent this instance of the logger
    logger.setVerbose(options.silent);
  }

  getDependencies() {
    let deps: Dependencies[] = [];
    let sourceFiles = this.program.getSourceFiles() || [];

    this.buildCache(sourceFiles);

    sourceFiles.map((file: ts.SourceFile) => {

      let filePath = file.fileName;

      if (path.extname(filePath) === '.ts') {

        if (filePath.lastIndexOf('.d.ts') === -1 && filePath.lastIndexOf('spec.ts') === -1) {
          logger.info('parsing', filePath);

          try {
            this.getSourceFileDecorators(file, deps);
          }
          catch (e) {
            logger.trace(e, file.fileName);
          }
        }

      }

      return deps;

    });

    return deps;
  }



  buildCache(sourceFiles) {
    sourceFiles.map((file: ts.SourceFile) => {

      let filePath = file.fileName;

      if (path.extname(filePath) === '.ts') {

        if (filePath.lastIndexOf('.d.ts') === -1 && filePath.lastIndexOf('spec.ts') === -1) {
          logger.info('parsing', filePath);

          try {
            this.buildComponentCache(file);
          }
          catch (e) {
            logger.trace(e, file.fileName);
          }
        }

      }


    });
  }

  private buildComponentCache(srcFile: ts.SourceFile): void {

    let classMap = [];


    srcFile.statements.filter(stmt => {
      let st: any = stmt;
      return stmt.kind == ts.SyntaxKind.ImportDeclaration && st.importClause &&
        st.importClause.namedBindings && st.importClause.namedBindings.elements &&
        st.moduleSpecifier && st.moduleSpecifier.text;
    }).forEach(stmt => {

      let st: any = stmt;
      let importPath = null;

      if (0 == st.moduleSpecifier.text.indexOf(".")) {
        importPath = srcFile.fileName.split("/");
        importPath.pop();
        importPath.push(st.moduleSpecifier.text + ".ts")
        importPath = path.normalize(importPath.join("/"));
      } else {
        importPath = process.cwd().split("/");
        importPath.push(st.moduleSpecifier.text + ".ts")
        importPath = path.normalize(importPath.join("/"));
      }
      if (!fs.existsSync(importPath)) {
        return;
      }
      st.importClause.namedBindings.elements.forEach(element => {
        classMap[element.name.text] = importPath;
      })

    });

    ts.forEachChild(srcFile, (node: ts.Node) => {


      if (node.decorators) {

        let visitNode = (visitedNode, index) => {
          let n: any = node;
          if (!n.name) {
            return;
          }
          let name = this.getSymboleName(node);
          let deps: Dependencies = <Dependencies>{};
          let metadata = node.decorators[node.decorators.length - 1];
          //let props = this.findProps(visitedNode);
          let props = visitedNode.expression.arguments[visitedNode.expression.arguments.length - 1].properties;


          if (this.isModule(metadata)) {
            return;
            deps = {
              name,
              file: srcFile.fileName.split('/').splice(-3).join('/'),
              providers: this.getModuleProviders(props),
              declarations: this.getModuleDeclations(classMap, props),
              imports: this.getModuleImports(props),
              exports: this.getModuleExports(props),
              bootstrap: this.getModuleBootstrap(props),
              __raw: props
            };
          }
          else if (this.isComponent(metadata)) {
            deps = {
              name,
              file: srcFile.fileName.split('/').splice(-3).join('/'),
              selector: this.getComponentSelector(props),
              providers: this.getComponentProviders(props),
              templateUrl: this.getComponentTemplateUrl(props),
              styleUrls: this.getComponentStyleUrls(props),
              __raw: props
            };
            let folder = srcFile.fileName.split('/');
            folder.pop();
            deps.templatePath = [folder.join("/") + '/' + deps.templateUrl[0]];
            deps.name += ` (${deps.selector})`;

          }

          let filepath = null;
          if (classMap[name]) {
            filepath = classMap[name];
          } else {
            filepath = path.normalize(srcFile.fileName);
          }

          this.debug(deps);
          this.__cache[`${filepath}#${name}`] = deps;
          this.__cache[deps.selector] = deps;
        }

        let filterByDecorators = (node) => {
          if (node.expression && node.expression.expression) {
            return /(NgModule|Component)/.test(node.expression.expression.text)
          }
          return false;
        };

        node.decorators
          .filter(filterByDecorators)
          .forEach(visitNode);
      }
      else {
        // process.stdout.write('.');
      }

    });

  }

  private getSourceFileDecorators(srcFile: ts.SourceFile, outputSymbols: Dependencies[]): void {
    let classMap = [];


    srcFile.statements.filter(stmt => {
      let st: any = stmt;
      return stmt.kind == ts.SyntaxKind.ImportDeclaration && st.importClause &&
        st.importClause.namedBindings && st.importClause.namedBindings.elements &&
        st.moduleSpecifier && st.moduleSpecifier.text;
    }).forEach(stmt => {

      let st: any = stmt;
      let importPath = null;

      if (0 == st.moduleSpecifier.text.indexOf(".")) {
        importPath = srcFile.fileName.split("/");
        importPath.pop();
        importPath.push(st.moduleSpecifier.text + ".ts")
        importPath = path.normalize(importPath.join("/"));
      } else {
        importPath = process.cwd().split("/");
        importPath.push(st.moduleSpecifier.text + ".ts")
        importPath = path.normalize(importPath.join("/"));
      }
      if (!fs.existsSync(importPath)) {
        return;
      }
      st.importClause.namedBindings.elements.forEach(element => {
        classMap[element.name.text] = importPath;
      })

    });

    ts.forEachChild(srcFile, (node: ts.Node) => {


      if (node.decorators) {

        let visitNode = (visitedNode, index) => {

          let name = this.getSymboleName(node);
          let deps: Dependencies = <Dependencies>{};
          let metadata = node.decorators[node.decorators.length - 1];
          let props = this.findProps(visitedNode);


          if (this.isModule(metadata)) {
            deps = {
              name,
              file: srcFile.fileName.split('/').splice(-3).join('/'),
              providers: this.getModuleProviders(props),
              declarations: this.getModuleDeclations(classMap, props),
              imports: this.getModuleImports(props),
              exports: this.getModuleExports(props),
              bootstrap: this.getModuleBootstrap(props),
              __raw: props
            };
            outputSymbols.push(deps);
          }
          else if (this.isComponent(metadata)) {
            // deps = {
            //   name,
            //   file: srcFile.fileName.split('/').splice(-3).join('/'),
            //   selector: this.getComponentSelector(props),
            //   providers: this.getComponentProviders(props),
            //   templateUrl: this.getComponentTemplateUrl(props),
            //   styleUrls: this.getComponentStyleUrls(props),
            //   __raw: props
            // };


            let filepath = null;
            if (classMap[name]) {
              filepath = classMap[name];
            } else {
              filepath = path.normalize(srcFile.fileName);
            }

            deps = this.__cache[`${filepath}#${name}`];
            deps.uses = this.getComponentDependentDirectives(srcFile.fileName, deps, props);
          }

          this.debug(deps);
          this.__cache[name] = deps;
        }

        let filterByDecorators = (node) => {
          if (node.expression && node.expression.expression) {
            return /(NgModule|Component)/.test(node.expression.expression.text)
          }
          return false;
        };

        node.decorators
          .filter(filterByDecorators)
          .forEach(visitNode);
      }
      else {
        // process.stdout.write('.');
      }

    });

  }
  private debug(deps: Dependencies) {
    logger.debug('debug', `${deps.name}:`);

    [
      'imports', 'exports', 'declarations', 'providers', 'bootstrap', 'uses'
    ].forEach(symbols => {
      if (deps[symbols] && deps[symbols].length > 0) {
        logger.debug('', `- ${symbols}:`);
        deps[symbols].map(i => i.name).forEach(d => {
          logger.debug('', `\t- ${d}`);
        });

      }
    });
  }

  private isComponent(metadata) {
    return metadata.expression.expression.text === 'Component';
  }

  private isModule(metadata) {
    return metadata.expression.expression.text === 'NgModule';
  }

  private getSymboleName(node): string {
    return node.name.text;
  }

  private getComponentSelector(props: NodeObject[]): string {
    return this.getSymbolDeps(props, 'selector').pop();
  }

  private getModuleProviders(props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'providers').map((providerName) => {
      return this.parseDeepIndentifier(providerName);
    });
  }

  private findProps(visitedNode) {
    return visitedNode.expression.arguments.pop().properties;
  }

  private getModuleDeclations(classMap, props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'declarations').map((name) => {

      let filepath = null;
      if (classMap[name]) {
        filepath = classMap[name];
      } else {
        logger.error(`Failed to find class with filepath ${filepath} and name ${name}`);
      }

      let component = this.findComponentSelectorByName(`${filepath}#${name}`);

      if (component) {
        return component;
      }
      return this.parseDeepIndentifier(name);
    });
  }

  private getModuleImports(props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'imports').map((name) => {
      return this.parseDeepIndentifier(name);
    });
  }

  private getModuleExports(props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'exports').map((name) => {
      return this.parseDeepIndentifier(name);
    });
  }

  private getModuleBootstrap(props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'bootstrap').map((name) => {
      return this.parseDeepIndentifier(name);
    });
  }



  private getComponentProviders(props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'providers').map((name) => {
      return this.parseDeepIndentifier(name);
    });
  }
  private getComponentDependentDirectives(filename, deps: Dependencies, props: NodeObject[]): Dependencies[] {
    let result: Dependencies[] = [];

    var contents = fs.readFileSync(deps.templatePath[0], 'utf8');

    let domparser = new DOMParser();
    let domdoc = domparser.parseFromString(contents);

    var all = domdoc.getElementsByTagName("[a-zA-Z0-9-]+");

    for (var i = 0, max = all.length; i < max; i++) {
      let foundSelector = all[i].nodeName;
      let component = this.__cache[foundSelector];
      if (!component) {
        // logger.warn('template-parsing', `Component with selector ${foundSelector} was not found in project`);
        continue;
      }
      // logger.warn('template-parsing', `Component with selector ${foundSelector} was found in project`);

      result.push(component);
    }

    return result;
  }
  // private getComponentDependentDirectives(filename, props: NodeObject[]): Dependencies[] {
  //   // console.log(filename, props);
  //   props.filter(prop => {
  //     return prop.name.text == "templateUrl"
  //   }).forEach(prop => {
  //     console.log(filename, prop.initializer.text,);
  //     templatePath =
  //   });
  //   return this.getSymbolDeps(props, 'providers').map((name) => {
  //     return this.parseDeepIndentifier(name);
  //   });
  // }

  private getComponentDirectives(props: NodeObject[]): Dependencies[] {
    return this.getSymbolDeps(props, 'directives').map((name) => {
      let identifier = this.parseDeepIndentifier(name);
      identifier.selector = this.findComponentSelectorByName(name);
      identifier.label = '';
      return identifier;
    });
  }

  private parseDeepIndentifier(name: string): any {
    let nsModule = name.split('.');
    if (nsModule.length > 1) {

      // cache deps with the same namespace (i.e Shared.*)
      if (this.__nsModule[nsModule[0]]) {
        this.__nsModule[nsModule[0]].push(name)
      }
      else {
        this.__nsModule[nsModule[0]] = [name];
      }

      return {
        ns: nsModule[0],
        name
      }
    }
    return {
      name
    };
  }

  private getComponentTemplateUrl(props: NodeObject[]): string[] {
    return this.sanitizeUrls(this.getSymbolDeps(props, 'templateUrl') || ["default"]);
  }

  private getComponentStyleUrls(props: NodeObject[]): string[] {
    return this.sanitizeUrls(this.getSymbolDeps(props, 'styleUrls'));
  }

  private sanitizeUrls(urls: string[]) {
    return urls.map(url => url.replace('./', ''));
  }

  private getSymbolDeps(props: NodeObject[], type: string): string[] {

    let deps = props.filter((node: NodeObject) => {
      return node.name.text === type;
    });

    let parseSymbolText = (text: string) => {
      if (text.indexOf('/') !== -1) {
        text = text.split('/').pop();
      }
      return [
        text
      ];
    };

    let buildIdentifierName = (node: NodeObject, name = '') => { 

      if (node.expression) {
        name = name ? `.${name}` : name;

        let nodeName = this.unknown;
        if (node.name) {
          nodeName = node.name.text;
        }
        else if (node.text) {
          nodeName = node.text;
        }
        else if (node.expression) {

          if (node.expression.text) {
            nodeName = node.expression.text;
          }
          else if(node.expression.elements) {

            if (node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
              nodeName = node.expression.elements.map( el => el.text ).join(', ');
              nodeName = `[${nodeName}]`;
            }

          }
        }

        if (node.kind ===  ts.SyntaxKind.SpreadElement) {
          return `...${nodeName}`;
        }
        return `${buildIdentifierName(node.expression, nodeName)}${name}`
      }

      return `${node.text}.${name}`;
    }

    let parseProviderConfiguration = (o: NodeObject): string => {
      // parse expressions such as:
      // { provide: APP_BASE_HREF, useValue: '/' },
      // or
      // { provide: 'Date', useFactory: (d1, d2) => new Date(), deps: ['d1', 'd2'] }

      let _genProviderName: string[] = [];
      let _providerProps: string[] = [];

      (o.properties || []).forEach((prop: NodeObject) => {

        let identifier = prop.initializer.text;
        if (prop.initializer.kind === ts.SyntaxKind.StringLiteral) {
          identifier = `'${identifier}'`;
        }

        // lambda function (i.e useFactory)
        if (prop.initializer.body) {
          let params = (prop.initializer.parameters || <any>[]).map((params: NodeObject) => params.name.text);
          identifier = `(${params.join(', ')}) => {}`;
        }

        // factory deps array
        else if (prop.initializer.elements) {
          let elements = (prop.initializer.elements || []).map((n: NodeObject) => {

            if (n.kind === ts.SyntaxKind.StringLiteral) {
              return `'${n.text}'`;
            }

            return n.text;
          });
          identifier = `[${elements.join(', ')}]`;
        }

        _providerProps.push([

          // i.e provide
          prop.name.text,

          // i.e OpaqueToken or 'StringToken'
          identifier

        ].join(': '));

      });

      return `{ ${_providerProps.join(', ')} }`;
    }

    let parseSymbolElements = (o: NodeObject | any): string => {
      // parse expressions such as: AngularFireModule.initializeApp(firebaseConfig)
      if (o.arguments) {
        let className = buildIdentifierName(o.expression);

        // function arguments could be really complexe. There are so
        // many use cases that we can't handle. Just print "args" to indicate
        // that we have arguments.

        let functionArgs = o.arguments.length > 0 ? 'args' : '';
        let text = `${className}(${functionArgs})`;
        return text;
      }

      // parse expressions such as: Shared.Module
      else if (o.expression) {
        let identifier = buildIdentifierName(o);
        return identifier;
      }

      return o.text ? o.text : parseProviderConfiguration(o);
    };

    let parseSymbols = (node: NodeObject): string[] => {

      let text = node.initializer.text;
      if (text) {
        return parseSymbolText(text);
      }

      else if (node.initializer.expression) {
        let identifier = parseSymbolElements(node.initializer);
        return [
          identifier
        ];
      }

      else if (node.initializer.elements) {
        return node.initializer.elements.map(parseSymbolElements);
      }

    };
    return deps.map(parseSymbols).pop() || [];
  }

  private findComponentSelectorByName(name: string) {
    return this.__cache[name];
  }

}
