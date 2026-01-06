import { AttributeSet } from "./AttributeSet";
import { ToolInterface } from "./ToolInterface";

export class CustomTool {
  constructor(
    builder: WrappedBuilder<[ToolInterface]>,
    offset: Offset,
    cornerOffset: Offset,
    attributeSet: AttributeSet
  ) {
    this._builder = builder;
    this._offset = offset;
    this._cornerOffset = cornerOffset;
    this._attributeSet = attributeSet;
  }

  private _builder: WrappedBuilder<[ToolInterface]>;

  public get builder(): WrappedBuilder<[ToolInterface]> {
    return this._builder;
  }

  private _offset: Offset;

  public get offset(): Offset {
    return this._offset;
  }

  private _cornerOffset: Offset;

  public get cornerOffset(): Offset {
    return this._cornerOffset;
  }

  private _attributeSet: AttributeSet;

  public get attributeSet(): AttributeSet {
    return this._attributeSet;
  }
}